import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse, forbiddenResponse } from '@/lib/session'
import { isManagerLevel } from '@/lib/roles'

const UpdateWorkItemSchema = z.object({
  title:           z.string().min(1).max(200).optional(),
  description:     z.string().max(2000).optional(),
  type:            z.enum(['TASK', 'MAINTENANCE', 'MEETING']).optional(),
  status:          z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional(),
  priority:        z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  entity:          z.enum(['FUEL_STATION', 'CONSTRUCTION', 'BOTH']).optional(),
  escalation_note: z.string().max(500).optional().nullable(),
  due_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assigned_to_id:  z.number().int().positive().optional().nullable(),
})

const workItemSelect = {
  id: true, title: true, description: true, type: true, status: true,
  priority: true, entity: true, escalation_note: true,
  due_date: true, created_at: true, updated_at: true,
  assigned_to: { select: { id: true, display_name: true, role: true } },
  created_by: { select: { id: true, display_name: true } },
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const { id } = await params
    const itemId = parseInt(id)
    if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const existing = await prisma.workItem.findUnique({ where: { id: itemId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const parsed = UpdateWorkItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }

    const { due_date, assigned_to_id, ...rest } = parsed.data
    const updateData: Record<string, unknown> = { ...rest }
    if (due_date !== undefined) updateData.due_date = due_date ? new Date(due_date) : null
    if (assigned_to_id !== undefined) updateData.assigned_to_id = assigned_to_id ?? null

    const item = await prisma.workItem.update({
      where: { id: itemId },
      data: updateData,
      select: workItemSelect,
    })

    await prisma.auditLog.create({
      data: {
        actor_id: session.userId,
        action: 'TASK_UPDATED',
        target_id: item.id,
        target_type: 'WorkItem',
        old_values: JSON.parse(JSON.stringify({
          status: existing.status,
          assigned_to_id: existing.assigned_to_id,
          entity: existing.entity,
        })) as Prisma.InputJsonValue,
        new_values: JSON.parse(JSON.stringify(updateData)) as Prisma.InputJsonValue,
      },
    })

    const prevAssignee = existing.assigned_to_id
    const newAssignee = assigned_to_id !== undefined ? (assigned_to_id ?? null) : prevAssignee
    if (newAssignee && newAssignee !== prevAssignee) {
      await prisma.notification.create({
        data: {
          user_id: newAssignee,
          title: 'Task assigned to you',
          message: `You have been assigned: "${item.title}"`,
          type: 'TASK_ASSIGNED',
          reference_id: item.id,
          reference_type: 'WorkItem',
        },
      })
    }

    return NextResponse.json({ data: item })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update work item' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const { id } = await params
    const itemId = parseInt(id)
    if (isNaN(itemId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const existing = await prisma.workItem.findUnique({ where: { id: itemId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.notification.deleteMany({ where: { reference_id: itemId, reference_type: 'WorkItem' } })
    await prisma.workItem.delete({ where: { id: itemId } })

    await prisma.auditLog.create({
      data: {
        actor_id: session.userId,
        action: 'TASK_DELETED',
        target_id: itemId,
        target_type: 'WorkItem',
        old_values: { title: existing.title, status: existing.status } as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete work item' }, { status: 500 })
  }
}
