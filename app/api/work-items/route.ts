import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse, forbiddenResponse } from '@/lib/session'
import { isManagerLevel, MANAGER_LEVEL_ROLES } from '@/lib/roles'

const CreateWorkItemSchema = z.object({
  title:          z.string().min(1).max(200),
  description:    z.string().max(2000).optional().default(''),
  type:           z.enum(['TASK', 'MAINTENANCE', 'MEETING']),
  priority:       z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  entity:         z.enum(['FUEL_STATION', 'CONSTRUCTION', 'BOTH']).default('BOTH'),
  escalation_note: z.string().max(500).optional(),
  due_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assigned_to_id: z.number().int().positive().optional().nullable(),
})

const workItemSelect = {
  id: true, title: true, description: true, type: true, status: true,
  priority: true, entity: true, escalation_note: true,
  due_date: true, created_at: true, updated_at: true,
  assigned_to: { select: { id: true, display_name: true, role: true } },
  created_by: { select: { id: true, display_name: true } },
}

async function createOverdueNotifications(
  items: Array<{ id: number; title: string; due_date: Date | null; status: string }>,
  managerIds: number[]
) {
  const now = new Date()
  for (const item of items) {
    if (!item.due_date || new Date(item.due_date) >= now || item.status === 'DONE') continue
    const exists = await prisma.notification.findFirst({
      where: { reference_id: item.id, reference_type: 'WorkItem', type: 'TASK_OVERDUE' },
    })
    if (exists) continue
    await prisma.notification.createMany({
      data: managerIds.map((uid) => ({
        user_id: uid,
        title: 'Task overdue',
        message: `"${item.title}" is past its due date`,
        type: 'TASK_OVERDUE',
        reference_id: item.id,
        reference_type: 'WorkItem',
      })),
    })
  }
}

function buildEntityWhere(role: string, queryEntity?: string | null): Record<string, unknown> {
  if (queryEntity && queryEntity !== 'ALL') {
    return { entity: queryEntity }
  }
  if (role === 'FUEL_MANAGER') return { entity: { in: ['FUEL_STATION', 'BOTH'] } }
  if (role === 'CONSTRUCTION_COORDINATOR') return { entity: { in: ['CONSTRUCTION', 'BOTH'] } }
  return {}
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const entityFilter = searchParams.get('entity')

    const where = buildEntityWhere(session.role, entityFilter)

    const items = await prisma.workItem.findMany({
      where,
      select: workItemSelect,
      orderBy: { created_at: 'desc' },
    })

    if (isManagerLevel(session.role)) {
      const managers = await prisma.user.findMany({
        where: { role: { in: [...MANAGER_LEVEL_ROLES] }, is_active: true },
        select: { id: true },
      })
      await createOverdueNotifications(
        items.map((i) => ({ id: i.id, title: i.title, due_date: i.due_date, status: i.status })),
        managers.map((m) => m.id)
      )
    }

    return NextResponse.json({ data: items })
  } catch {
    return unauthorizedResponse()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const body = await req.json()
    const parsed = CreateWorkItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }

    const { due_date, assigned_to_id, ...rest } = parsed.data

    const item = await prisma.workItem.create({
      data: {
        ...rest,
        due_date: due_date ? new Date(due_date) : null,
        assigned_to_id: assigned_to_id ?? null,
        created_by_id: session.userId,
      },
      select: workItemSelect,
    })

    await prisma.auditLog.create({
      data: {
        actor_id: session.userId,
        action: 'TASK_CREATED',
        target_id: item.id,
        target_type: 'WorkItem',
        new_values: { title: item.title, type: item.type, status: item.status, entity: item.entity } as Prisma.InputJsonValue,
      },
    })

    if (assigned_to_id) {
      await prisma.notification.create({
        data: {
          user_id: assigned_to_id,
          title: 'New task assigned',
          message: `You have been assigned: "${item.title}"`,
          type: 'TASK_ASSIGNED',
          reference_id: item.id,
          reference_type: 'WorkItem',
        },
      })
    }

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create work item' }, { status: 500 })
  }
}
