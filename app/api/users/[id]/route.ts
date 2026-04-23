import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse, forbiddenResponse, hashPassword } from '@/lib/session'
import { isManagerLevel, ALL_ROLES } from '@/lib/roles'

const UpdateUserSchema = z.object({
  display_name:      z.string().min(1).max(100).optional(),
  role:              z.enum(ALL_ROLES).optional(),
  is_active:         z.boolean().optional(),
  password:          z.string().min(6).max(100).optional(),
  entity:            z.enum(['FUEL_STATION', 'CONSTRUCTION', 'BOTH']).optional().nullable(),
  contract_status:   z.enum(['ACTIVE', 'PROBATION', 'FIXED_TERM', 'EXPIRED']).optional().nullable(),
  contract_end_date: z.string().optional().nullable().transform(v => v ? new Date(v) : v === null ? null : undefined),
  first_name:        z.string().max(100).optional(),
  last_name:         z.string().max(100).optional(),
  email:             z.string().email().max(200).optional().or(z.literal('')).transform(v => v || undefined),
  phone:             z.string().max(30).optional(),
  job_title:         z.string().max(100).optional(),
  start_date:        z.string().optional().transform(v => v ? new Date(v) : undefined),
})

const userSelect = {
  id: true, username: true, display_name: true, role: true, is_active: true,
  entity: true, contract_status: true, contract_end_date: true,
  first_name: true, last_name: true, email: true,
  phone: true, job_title: true, start_date: true,
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const { id } = await params
    const targetId = parseInt(id)
    if (isNaN(targetId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })

    const body = await req.json()
    const parsed = UpdateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }

    const { password, ...rest } = parsed.data

    if (targetId === session.userId && rest.role && !isManagerLevel(rest.role)) {
      return NextResponse.json({ error: 'Cannot remove your own manager-level role' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { ...rest }
    if (password) updateData.password_hash = await hashPassword(password)

    const user = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: userSelect,
    })
    return NextResponse.json({ data: user })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      const isEmail = err.message.includes('email')
      return NextResponse.json(
        { error: isEmail ? 'Email already in use' : 'Username already exists' },
        { status: 409 }
      )
    }
    if (err instanceof Error && err.message.includes('Record to update not found')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return unauthorizedResponse()
  }
}
