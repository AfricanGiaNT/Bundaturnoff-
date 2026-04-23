import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse, forbiddenResponse, hashPassword } from '@/lib/session'
import { isManagerLevel, ALL_ROLES } from '@/lib/roles'

const profileFields = {
  first_name: z.string().max(100).optional(),
  last_name:  z.string().max(100).optional(),
  email:      z.string().email().max(200).optional().or(z.literal('')).transform(v => v || undefined),
  phone:      z.string().max(30).optional(),
  job_title:  z.string().max(100).optional(),
  start_date: z.string().optional().transform(v => v ? new Date(v) : undefined),
}

const CreateUserSchema = z.object({
  username:          z.string().min(2).max(50),
  display_name:      z.string().min(1).max(100),
  role:              z.enum(ALL_ROLES),
  password:          z.string().min(6).max(100),
  entity:            z.enum(['FUEL_STATION', 'CONSTRUCTION', 'BOTH']).optional(),
  contract_status:   z.enum(['ACTIVE', 'PROBATION', 'FIXED_TERM', 'EXPIRED']).optional(),
  contract_end_date: z.string().optional().transform(v => v ? new Date(v) : undefined),
  ...profileFields,
})

const userSelect = {
  id: true, username: true, display_name: true, role: true,
  is_active: true, created_at: true, entity: true,
  contract_status: true, contract_end_date: true,
  first_name: true, last_name: true, email: true,
  phone: true, job_title: true, start_date: true,
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: [{ entity: 'asc' }, { display_name: 'asc' }],
    })
    return NextResponse.json({ data: users })
  } catch {
    return unauthorizedResponse()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const body = await req.json()
    const parsed = CreateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }

    const { username, display_name, role, password, ...profile } = parsed.data
    const password_hash = await hashPassword(password)

    const user = await prisma.user.create({
      data: { username, display_name, role, password_hash, ...profile },
      select: userSelect,
    })
    return NextResponse.json({ data: user }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      const isEmail = err.message.includes('email')
      return NextResponse.json(
        { error: isEmail ? 'Email already in use' : 'Username already exists' },
        { status: 409 }
      )
    }
    console.error(err)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
