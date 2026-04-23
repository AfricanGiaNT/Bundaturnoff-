import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse, forbiddenResponse } from '@/lib/session'
import { isManagerLevel } from '@/lib/roles'
import { getQuarterMonths } from '@/lib/kpi-weights'
import type { DashboardAlert, DashboardSummary } from '@/lib/types'

export type { DashboardAlert, DashboardSummary }

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    if (!isManagerLevel(session.role)) return forbiddenResponse()

    const { searchParams } = new URL(req.url)
    const now      = new Date()
    const year     = parseInt(searchParams.get('year')    ?? String(now.getFullYear()))
    const quarter  = parseInt(searchParams.get('quarter') ?? String(Math.ceil((now.getMonth() + 1) / 3)))

    if (quarter < 1 || quarter > 4) {
      return NextResponse.json({ error: 'Invalid quarter' }, { status: 400 })
    }

    const qMonths     = getQuarterMonths(quarter)
    const prevQuarter = quarter === 1 ? 4 : quarter - 1
    const prevYear    = quarter === 1 ? year - 1 : year
    const pqMonths    = getQuarterMonths(prevQuarter)
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [
      activeUsers,
      currentKPIs,
      prevKPIs,
      bonusResult,
      unsignedKPIs,
      activePIPs,
      overdueCount,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { is_active: true },
        select: { id: true, role: true },
      }),
      prisma.employeeKPI.findMany({
        where: { month: { in: qMonths }, year },
        select: { user_id: true, overall_score: true, kpi_schedule_signed: true },
      }),
      prisma.employeeKPI.findMany({
        where: { month: { in: pqMonths }, year: prevYear },
        select: { user_id: true, overall_score: true },
      }),
      prisma.employeeKPI.aggregate({
        _sum: { bonus_earned: true },
        where: { month: { in: qMonths }, year },
      }),
      prisma.employeeKPI.findMany({
        where: { kpi_schedule_signed: false, month: { in: qMonths }, year },
        select: { user_id: true },
        distinct: ['user_id'],
      }),
      prisma.pipRecord.findMany({
        where: { status: 'ACTIVE', review_date: { lte: sevenDaysOut } },
        select: { id: true, user_id: true, review_date: true },
      }),
      prisma.workItem.count({
        where: { due_date: { lt: now }, status: { notIn: ['DONE', 'BLOCKED'] } },
      }),
    ])

    // Headcount buckets using best score per user for the quarter
    const bestScoreByUser = new Map<number, number>()
    for (const r of currentKPIs) {
      if (r.overall_score == null) continue
      const existing = bestScoreByUser.get(r.user_id)
      if (existing == null || r.overall_score > existing) {
        bestScoreByUser.set(r.user_id, r.overall_score)
      }
    }

    let on_target = 0, below_target = 0, unsatisfactory = 0, no_data = 0
    for (const u of activeUsers) {
      const score = bestScoreByUser.get(u.id)
      if (score == null) { no_data++; continue }
      if (score >= 80) on_target++
      else if (score >= 60) below_target++
      else unsatisfactory++
    }

    // Previous quarter buckets for trend
    const prevBestByUser = new Map<number, number>()
    for (const r of prevKPIs) {
      if (r.overall_score == null) continue
      const existing = prevBestByUser.get(r.user_id)
      if (existing == null || r.overall_score > existing) {
        prevBestByUser.set(r.user_id, r.overall_score)
      }
    }
    let prev_on_target = 0, prev_below_target = 0
    for (const u of activeUsers) {
      const score = prevBestByUser.get(u.id)
      if (score == null) continue
      if (score >= 80) prev_on_target++
      else if (score >= 60) prev_below_target++
    }

    const on_target_delta    = on_target - prev_on_target
    const below_target_delta = below_target - prev_below_target
    const direction: 'up' | 'down' | 'flat' =
      on_target_delta > 0 ? 'up' : on_target_delta < 0 ? 'down' : 'flat'

    const bonus_liability = bonusResult._sum.bonus_earned ?? 0

    // Build alerts
    const alerts: DashboardAlert[] = []

    if (unsignedKPIs.length > 0) {
      alerts.push({
        type: 'UNSIGNED_KPI',
        severity: 'amber',
        count: unsignedKPIs.length,
        label: `${unsignedKPIs.length} unsigned KPI schedule${unsignedKPIs.length !== 1 ? 's' : ''}`,
        action_href: '/work/kpi',
      })
    }

    const overduePIPs = activePIPs.filter((p) => new Date(p.review_date) <= now)
    const dueSoonPIPs = activePIPs.filter((p) => new Date(p.review_date) > now)
    if (overduePIPs.length > 0) {
      alerts.push({
        type: 'PIP_OVERDUE',
        severity: 'red',
        count: overduePIPs.length,
        label: `${overduePIPs.length} PIP review${overduePIPs.length !== 1 ? 's' : ''} overdue`,
        action_href: '/work/kpi',
      })
    }
    if (dueSoonPIPs.length > 0) {
      alerts.push({
        type: 'PIP_DUE',
        severity: 'amber',
        count: dueSoonPIPs.length,
        label: `${dueSoonPIPs.length} PIP review${dueSoonPIPs.length !== 1 ? 's' : ''} due this week`,
        action_href: '/work/kpi',
      })
    }

    if (overdueCount > 0) {
      alerts.push({
        type: 'OVERDUE_TASKS',
        severity: 'red',
        count: overdueCount,
        label: `${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''}`,
        action_href: '/work/kanban',
      })
    }

    const usersWithAnyKPI = new Set(currentKPIs.map((r) => r.user_id))
    const missingKPICount = activeUsers.filter((u) => !usersWithAnyKPI.has(u.id)).length
    if (missingKPICount > 0) {
      alerts.push({
        type: 'MISSING_KPI',
        severity: 'amber',
        count: missingKPICount,
        label: `${missingKPICount} employee${missingKPICount !== 1 ? 's' : ''} with no KPI data this quarter`,
        action_href: '/work/kpi',
      })
    }

    if (unsatisfactory > 0) {
      alerts.push({
        type: 'UNSATISFACTORY',
        severity: 'red',
        count: unsatisfactory,
        label: `${unsatisfactory} employee${unsatisfactory !== 1 ? 's' : ''} rated Unsatisfactory`,
        action_href: '/work/kpi',
      })
    }

    // Sort: red first, then amber
    alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'red' ? -1 : 1))

    const summary: DashboardSummary = {
      headcount: { total: activeUsers.length, on_target, below_target, unsatisfactory, no_data },
      trend: { on_target_delta, below_target_delta, direction },
      bonus_liability,
      alerts,
      quarter,
      year,
    }

    return NextResponse.json({ data: summary })
  } catch (err) {
    console.error(err)
    return unauthorizedResponse()
  }
}
