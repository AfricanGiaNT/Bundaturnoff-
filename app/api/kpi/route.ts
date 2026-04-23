import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse, forbiddenResponse } from '@/lib/session'
import { isManagerLevel, MANAGER_LEVEL_ROLES } from '@/lib/roles'
import { calculateOverallScore, getRatingBand, getQuarterMonths } from '@/lib/kpi-weights'

const KPISchema = z.object({
  user_id: z.number().int().positive(),
  month:   z.number().int().min(1).max(12),
  year:    z.number().int().min(2020).max(2100),
  // HR
  attendance_rate:            z.number().min(0).max(100).optional().nullable(),
  target_attendance_rate:     z.number().min(0).max(100).optional().nullable(),
  leave_days_taken:           z.number().int().min(0).optional().nullable(),
  target_leave_days_taken:    z.number().int().min(0).optional().nullable(),
  disciplinary_count:         z.number().int().min(0).optional().nullable(),
  target_disciplinary_count:  z.number().int().min(0).optional().nullable(),
  // Accountant
  reports_submitted_on_time:     z.number().int().min(0).optional().nullable(),
  target_reports_submitted:      z.number().int().min(0).optional().nullable(),
  reconciliation_accuracy:       z.number().min(0).max(100).optional().nullable(),
  target_reconciliation_accuracy: z.number().min(0).max(100).optional().nullable(),
  invoices_processed:            z.number().int().min(0).optional().nullable(),
  target_invoices_processed:     z.number().int().min(0).optional().nullable(),
  // Warehouse / StorageClerk
  stock_accuracy_pct:           z.number().min(0).max(100).optional().nullable(),
  target_stock_accuracy_pct:    z.number().min(0).max(100).optional().nullable(),
  shrinkage_losses:             z.number().int().min(0).optional().nullable(),
  target_shrinkage_losses:      z.number().int().min(0).optional().nullable(),
  stock_takes_completed:        z.number().int().min(0).optional().nullable(),
  target_stock_takes_completed: z.number().int().min(0).optional().nullable(),
  // Manager
  team_task_completion_rate:  z.number().min(0).max(100).optional().nullable(),
  target_task_completion_rate: z.number().min(0).max(100).optional().nullable(),
  staff_performance_score:    z.number().min(0).max(100).optional().nullable(),
  target_staff_performance:   z.number().min(0).max(100).optional().nullable(),
  revenue_vs_target:          z.number().min(0).optional().nullable(),
  target_revenue_vs_target:   z.number().min(0).optional().nullable(),
  // Metadata
  bonus_earned:        z.number().min(0).optional().nullable(),
  kpi_schedule_signed: z.boolean().optional(),
  signed_date:         z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  evidence_notes:      z.record(z.string(), z.unknown()).optional().nullable(),
})

const kpiWithUser = {
  user: { select: { id: true, display_name: true, role: true, username: true } },
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const month   = parseInt(searchParams.get('month') ?? '')
    const year    = parseInt(searchParams.get('year') ?? '')
    const quarter = parseInt(searchParams.get('quarter') ?? '')

    const where: Record<string, unknown> = {}
    if (!isNaN(year)) where.year = year
    if (!isNaN(quarter) && quarter >= 1 && quarter <= 4) {
      where.month = { in: getQuarterMonths(quarter) }
    } else if (!isNaN(month)) {
      where.month = month
    }
    if (!isManagerLevel(session.role)) where.user_id = session.userId

    const records = await prisma.employeeKPI.findMany({
      where,
      include: kpiWithUser,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return NextResponse.json({ data: records })
  } catch {
    return unauthorizedResponse()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const body = await req.json()
    const parsed = KPISchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }

    const { user_id, month, year, ...metrics } = parsed.data

    const user = await prisma.user.findUnique({ where: { id: user_id }, select: { role: true, display_name: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Always compute overall_score and rating_band server-side
    const overall_score = calculateOverallScore(metrics as Record<string, unknown>, user.role)
    const rating_band   = overall_score > 0 ? getRatingBand(overall_score) : null

    const existing = await prisma.employeeKPI.findUnique({
      where: { user_id_month_year: { user_id, month, year } },
    })

    const evidenceNotes = metrics.evidence_notes === null
      ? Prisma.DbNull
      : (metrics.evidence_notes as Prisma.InputJsonValue | undefined)

    const record = await prisma.employeeKPI.upsert({
      where: { user_id_month_year: { user_id, month, year } },
      create: { user_id, month, year, ...metrics, overall_score, rating_band, evidence_notes: evidenceNotes },
      update: { ...metrics, overall_score, rating_band, evidence_notes: evidenceNotes },
      include: kpiWithUser,
    })

    await prisma.auditLog.create({
      data: {
        actor_id:   session.userId,
        action:     'KPI_UPDATED',
        target_id:  record.id,
        target_type: 'EmployeeKPI',
        old_values: existing ? (JSON.parse(JSON.stringify(existing)) as Prisma.InputJsonValue) : undefined,
        new_values: JSON.parse(JSON.stringify({ user_id, month, year, overall_score, rating_band, ...metrics })) as Prisma.InputJsonValue,
      },
    })

    const managers = await prisma.user.findMany({
      where: { role: { in: [...MANAGER_LEVEL_ROLES] }, is_active: true },
      select: { id: true },
    })
    const managerIds = managers.map((m) => m.id)

    // Notify on below-threshold metrics
    const roleMetrics = (await import('@/lib/kpi-weights')).KPI_WEIGHTS[user.role] ?? []
    const below: string[] = []
    for (const m of roleMetrics) {
      const val    = (record as Record<string, unknown>)[m.valueField] as number | null
      const target = (record as Record<string, unknown>)[m.targetField] as number | null
      if (val == null || target == null || target === 0) continue
      const pct = m.lowerIsBetter ? (target / val) * 100 : (val / target) * 100
      if (pct < 80) below.push(m.label)
    }
    if (below.length > 0 && managerIds.length > 0) {
      await prisma.notification.createMany({
        data: managerIds.map((uid) => ({
          user_id:        uid,
          title:          'KPI below threshold',
          message:        `${user.display_name}'s ${below.join(', ')} is below 80% of target`,
          type:           'KPI_BELOW_THRESHOLD',
          reference_id:   record.id,
          reference_type: 'EmployeeKPI',
        })),
      })
    }

    // Check for 2 consecutive quarter drops
    await checkConsecutiveDrops(user_id, month, year, overall_score, managerIds)

    return NextResponse.json({ data: record })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save KPI entry' }, { status: 500 })
  }
}

async function checkConsecutiveDrops(
  userId: number, month: number, year: number,
  currentScore: number, managerIds: number[]
) {
  if (currentScore === 0 || managerIds.length === 0) return

  // Get the last 6 months of KPI records for this user to calculate quarterly averages
  const recentRecords = await prisma.employeeKPI.findMany({
    where: { user_id: userId, overall_score: { not: null } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 9,
    select: { month: true, year: true, overall_score: true },
  })

  // Group into quarters
  const qMap = new Map<string, number[]>()
  for (const r of recentRecords) {
    const q   = Math.ceil(r.month / 3)
    const key = `${r.year}-Q${q}`
    if (!qMap.has(key)) qMap.set(key, [])
    qMap.get(key)!.push(r.overall_score as number)
  }

  const currentQ   = Math.ceil(month / 3)
  const currentKey = `${year}-Q${currentQ}`
  const prevQ      = currentQ === 1 ? 4 : currentQ - 1
  const prevYear   = currentQ === 1 ? year - 1 : year
  const prevKey    = `${prevYear}-Q${prevQ}`
  const prev2Q     = prevQ === 1 ? 4 : prevQ - 1
  const prev2Year  = prevQ === 1 ? prevYear - 1 : prevYear
  const prev2Key   = `${prev2Year}-Q${prev2Q}`

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  const cScores  = qMap.get(currentKey) ?? []
  const p1Scores = qMap.get(prevKey) ?? []
  const p2Scores = qMap.get(prev2Key) ?? []

  if (cScores.length === 0 || p1Scores.length === 0 || p2Scores.length === 0) return

  const cAvg  = avg(cScores)
  const p1Avg = avg(p1Scores)
  const p2Avg = avg(p2Scores)

  if (cAvg < p1Avg && p1Avg < p2Avg) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { display_name: true } })
    await prisma.notification.createMany({
      data: managerIds.map((uid) => ({
        user_id:        uid,
        title:          'KPI score declining',
        message:        `${user?.display_name ?? 'An employee'} has had declining KPI scores for 2 consecutive quarters`,
        type:           'SCORE_DROPPED',
        reference_id:   userId,
        reference_type: 'User',
      })),
    })
  }
}
