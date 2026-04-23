import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse, forbiddenResponse } from '@/lib/session'
import { isManagerLevel } from '@/lib/roles'

const UpdatePIPSchema = z.object({
  current_progress:    z.string().optional(),
  improvement_targets: z.string().optional(),
  review_date:         z.string().optional().transform(v => v ? new Date(v) : undefined),
  status:              z.enum(['ACTIVE', 'CLOSED']).optional(),
  outcome:             z.enum(['SUCCESS', 'EXTENDED', 'TERMINATED']).optional(),
  closed_date:         z.string().optional().nullable().transform(v => v ? new Date(v) : null),
}).refine(
  (data) => data.status !== 'CLOSED' || !!data.outcome,
  { message: 'outcome is required when closing a PIP', path: ['outcome'] }
)

const pipSelect = {
  id: true, user_id: true, trigger_reason: true, issued_date: true,
  review_date: true, improvement_targets: true, current_progress: true,
  status: true, outcome: true, closed_date: true, created_at: true, updated_at: true,
  user:       { select: { id: true, display_name: true, role: true } },
  created_by: { select: { id: true, display_name: true } },
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const { id } = await params
    const pipId = parseInt(id)
    if (isNaN(pipId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const existing = await prisma.pipRecord.findUnique({ where: { id: pipId } })
    if (!existing) return NextResponse.json({ error: 'PIP not found' }, { status: 404 })

    const body = await req.json()
    const parsed = UpdatePIPSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }

    const pip = await prisma.pipRecord.update({
      where: { id: pipId },
      data: parsed.data,
      select: pipSelect,
    })

    await prisma.auditLog.create({
      data: {
        actor_id:    session.userId,
        action:      'PIP_UPDATED',
        target_id:   pipId,
        target_type: 'PipRecord',
        old_values:  JSON.parse(JSON.stringify({ status: existing.status, outcome: existing.outcome })) as Prisma.InputJsonValue,
        new_values:  JSON.parse(JSON.stringify(parsed.data)) as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ data: pip })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update PIP' }, { status: 500 })
  }
}
