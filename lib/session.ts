import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'dashboard_session'
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET env var is not set')
  return s
}

function b64url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromB64url(str: string): string {
  const padded = str + '=='.slice(0, (4 - (str.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2)
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return bytes
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getHmacKey(): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(getSecret())
  return crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  )
}

export interface SessionPayload {
  userId: number
  role: string
  entity?: string | null
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const data = b64url(JSON.stringify({ ...payload, exp: Date.now() + SESSION_DURATION_MS }))
  const key = await getHmacKey()
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${bytesToHex(sigBuf)}`
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const data = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const key = await getHmacKey()
    const valid = await crypto.subtle.verify(
      'HMAC', key, hexToBytes(sig), new TextEncoder().encode(data)
    )
    if (!valid) return null
    const parsed = JSON.parse(fromB64url(data))
    if (parsed.exp < Date.now()) return null
    return { userId: parsed.userId, role: parsed.role, entity: parsed.entity ?? null }
  } catch {
    return null
  }
}

export async function requireAuth(req: NextRequest): Promise<SessionPayload> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySession(token) : null
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  return session
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function makeSessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  }
}

export async function hashPassword(plain: string): Promise<string> {
  const nodeCrypto = await import('crypto')
  const salt = nodeCrypto.randomBytes(16).toString('hex')
  const hash = await new Promise<string>((resolve, reject) => {
    nodeCrypto.scrypt(plain, salt, 64, (err, derived) => {
      if (err) reject(err)
      else resolve(derived.toString('hex'))
    })
  })
  return `${salt}:${hash}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const nodeCrypto = await import('crypto')
    const [salt, hash] = stored.split(':')
    const derived = await new Promise<Buffer>((resolve, reject) => {
      nodeCrypto.scrypt(plain, salt, 64, (err, d) => {
        if (err) reject(err)
        else resolve(d as Buffer)
      })
    })
    return nodeCrypto.timingSafeEqual(derived, Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}
