import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse, forbiddenResponse } from '@/lib/session'
import { isManagerLevel, MANAGER_LEVEL_ROLES } from '@/lib/roles'

const CreatePIPSchema = z.object({
  user_id:             z.number().int().positive(),
  trigger_reason:      z.string().min(1).max(1000),
  issued_date:         z.string().transform(v => new Date(v)),
  review_date:         z.string().transform(v => new Date(v)),
  improvement_targets: z.string().min(1),
  current_progress:    z.string().optional(),
})

const pipSelect = {
  id: true, user_id: true, trigger_reason: true, issued_date: true,
  review_date: true, improvement_targets: true, current_progress: true,
  status: true, outcome: true, closed_date: true, created_at: true, updated_at: true,
  user:       { select: { id: true, display_name: true, role: true } },
  created_by: { select: { id: true, display_name: true } },
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (userId) where.user_id = parseInt(userId)
    if (status) where.status = status

    const pips = await prisma.pipRecord.findMany({
      where,
      select: pipSelect,
      orderBy: { created_at: 'desc' },
    })
    return NextResponse.json({ data: pips })
  } catch {
    return unauthorizedResponse()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const body = await req.json()
    const parsed = CreatePIPSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }

    const pip = await prisma.pipRecord.create({
      data: { ...parsed.data, created_by_id: session.userId },
      select: pipSelect,
    })

    await prisma.auditLog.create({
      data: {
        actor_id:    session.userId,
        action:      'PIP_CREATED',
        target_id:   pip.id,
        target_type: 'PipRecord',
        new_values:  JSON.parse(JSON.stringify(parsed.data)) as Prisma.InputJsonValue,
      },
    })

    // Notify all manager-level users
    const managers = await prisma.user.findMany({
      where: { role: { in: [...MANAGER_LEVEL_ROLES] }, is_active: true },
      select: { id: true },
    })
    await prisma.notification.createMany({
      data: managers.map((m) => ({
        user_id:        m.id,
        title:          'New PIP issued',
        message:        `A Performance Improvement Plan has been issued for ${pip.user.display_name}`,
        type:           'PIP_DUE',
        reference_id:   pip.id,
        reference_type: 'PipRecord',
      })),
    })
    // Notify the subject user too
    await prisma.notification.create({
      data: {
        user_id:        pip.user_id,
        title:          'Performance Improvement Plan',
        message:        'A Performance Improvement Plan has been issued for you. Please review with your manager.',
        type:           'PIP_DUE',
        reference_id:   pip.id,
        reference_type: 'PipRecord',
      },
    })

    return NextResponse.json({ data: pip }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create PIP' }, { status: 500 })
  }
}
