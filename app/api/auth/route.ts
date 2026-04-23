import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signSession, verifyPassword, makeSessionCookie, requireAuth } from '@/lib/session'

// In-memory brute-force protection (resets on server restart)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

function checkLockout(username: string): boolean {
  const entry = loginAttempts.get(username)
  if (!entry) return false
  if (entry.lockedUntil > Date.now()) return true
  return false
}

function recordFailure(username: string) {
  const entry = loginAttempts.get(username) ?? { count: 0, lockedUntil: 0 }
  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS
  }
  loginAttempts.set(username, entry)
}

function clearAttempts(username: string) {
  loginAttempts.delete(username)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.username || !body?.password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  const { username, password } = body as { username: string; password: string }

  if (checkLockout(username)) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in 15 minutes.' },
      { status: 429 }
    )
  }

  const user = await prisma.user.findUnique({ where: { username } })

  if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
    recordFailure(username)
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  clearAttempts(username)
  const token = await signSession({ userId: user.id, role: user.role, entity: user.entity ?? null })
  const res = NextResponse.json({ ok: true, role: user.role, display_name: user.display_name })
  res.cookies.set(makeSessionCookie(token))
  return res
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, display_name: true, role: true, username: true, entity: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json({ data: user })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('dashboard_session')
  return res
}
