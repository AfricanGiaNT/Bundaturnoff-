import {
  WeeklyRow,
  StaffMember,
  OverviewKPIs,
  IndividualSummary,
  ShiftSummary,
  WeeklySummaryRow,
  MonthlySummaryRow,
  RecentWeekRow,
} from './types'

export function computeOverview(rows: WeeklyRow[], staff: StaffMember[]): OverviewKPIs {
  const total_fuel = rows.reduce((s, r) => s + r.fuel_sales_litres, 0)
  const total_lub = rows.reduce((s, r) => s + r.lub_qty, 0)
  const active_staff = staff.filter((s) => s.status === 'Active').length

  // Best attendant by total fuel
  const byAttendant: Record<string, number> = {}
  for (const r of rows) {
    byAttendant[r.attendant_id] = (byAttendant[r.attendant_id] || 0) + r.fuel_sales_litres
  }
  let bestAttendantId = ''
  let bestAttendantTotal = 0
  for (const [id, total] of Object.entries(byAttendant)) {
    if (total > bestAttendantTotal) {
      bestAttendantTotal = total
      bestAttendantId = id
    }
  }
  const bestAttendantStaff = staff.find((s) => s.attendant_id === bestAttendantId)

  // Best shift by total fuel
  const byShift: Record<string, number> = {}
  for (const r of rows) {
    byShift[r.shift] = (byShift[r.shift] || 0) + r.fuel_sales_litres
  }
  let bestShift = ''
  let bestShiftTotal = 0
  for (const [shift, total] of Object.entries(byShift)) {
    if (total > bestShiftTotal) {
      bestShiftTotal = total
      bestShift = shift
    }
  }

  // Recent 6 weeks
  const weekMap: Record<string, RecentWeekRow> = {}
  for (const r of rows) {
    const key = r.week_start
    if (!weekMap[key]) {
      weekMap[key] = { week_start: r.week_start, week_end: r.week_end, shift_a: 0, shift_b: 0, shift_c: 0, total: 0 }
    }
    const w = weekMap[key]
    if (r.shift === 'A') w.shift_a += r.fuel_sales_litres
    else if (r.shift === 'B') w.shift_b += r.fuel_sales_litres
    else if (r.shift === 'C') w.shift_c += r.fuel_sales_litres
    w.total += r.fuel_sales_litres
  }
  const recent_weeks = Object.values(weekMap)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .slice(0, 6)

  return {
    total_fuel_sales: total_fuel,
    total_lub_qty: total_lub,
    best_attendant: {
      name: bestAttendantStaff?.attendant_name || bestAttendantId,
      total: bestAttendantTotal,
    },
    best_shift: { shift: bestShift, total: bestShiftTotal },
    active_staff,
    recent_weeks,
  }
}

export function computeIndividual(rows: WeeklyRow[], staff: StaffMember[]): IndividualSummary[] {
  return staff.map((s) => {
    const myRows = rows.filter((r) => r.attendant_id === s.attendant_id && r.fuel_sales_litres > 0)
    const total_fuel = myRows.reduce((acc, r) => acc + r.fuel_sales_litres, 0)
    const total_lub = rows.filter((r) => r.attendant_id === s.attendant_id).reduce((acc, r) => acc + r.lub_qty, 0)
    const weeks_worked = myRows.length
    const avg_weekly_fuel = weeks_worked > 0 ? total_fuel / weeks_worked : 0
    const best_week_fuel = myRows.length > 0 ? Math.max(...myRows.map((r) => r.fuel_sales_litres)) : 0
    const worst_week_fuel = myRows.length > 0 ? Math.min(...myRows.map((r) => r.fuel_sales_litres)) : 0
    return {
      attendant_id: s.attendant_id,
      attendant_name: s.attendant_name,
      shift: s.shift,
      role: s.role,
      weeks_worked,
      total_fuel,
      total_lub,
      avg_weekly_fuel,
      best_week_fuel,
      worst_week_fuel,
    }
  })
}

export function computeShiftSummary(rows: WeeklyRow[], staff: StaffMember[]): ShiftSummary[] {
  const shifts = ['A', 'B', 'C']
  return shifts.map((shift) => {
    const shiftRows = rows.filter((r) => r.shift === shift)
    const total_fuel = shiftRows.reduce((s, r) => s + r.fuel_sales_litres, 0)
    const total_lub = shiftRows.reduce((s, r) => s + r.lub_qty, 0)
    const num_attendants = staff.filter((s) => s.shift === shift && s.status === 'Active').length

    // Group by week for best/worst
    const weekTotals: Record<string, number> = {}
    for (const r of shiftRows) {
      weekTotals[r.week_start] = (weekTotals[r.week_start] || 0) + r.fuel_sales_litres
    }
    const weekVals = Object.values(weekTotals)
    const best_week = weekVals.length > 0 ? Math.max(...weekVals) : 0
    const worst_week = weekVals.length > 0 ? Math.min(...weekVals) : 0
    const avg_weekly = weekVals.length > 0 ? total_fuel / weekVals.length : 0

    return { shift, total_fuel, total_lub, avg_weekly, num_attendants, best_week, worst_week }
  })
}

export function computeWeeklySummary(rows: WeeklyRow[]): WeeklySummaryRow[] {
  const weekMap: Record<string, WeeklySummaryRow> = {}
  for (const r of rows) {
    const key = r.week_start
    if (!weekMap[key]) {
      weekMap[key] = {
        week_start: r.week_start,
        week_end: r.week_end,
        shift_a: 0,
        shift_b: 0,
        shift_c: 0,
        total: 0,
        total_lub: 0,
        wow_change: 0,
        wow_pct: 0,
      }
    }
    const w = weekMap[key]
    if (r.shift === 'A') w.shift_a += r.fuel_sales_litres
    else if (r.shift === 'B') w.shift_b += r.fuel_sales_litres
    else if (r.shift === 'C') w.shift_c += r.fuel_sales_litres
    w.total += r.fuel_sales_litres
    w.total_lub += r.lub_qty
  }

  const sorted = Object.values(weekMap).sort((a, b) => a.week_start.localeCompare(b.week_start))
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].total
    const curr = sorted[i].total
    sorted[i].wow_change = curr - prev
    sorted[i].wow_pct = prev > 0 ? ((curr - prev) / prev) * 100 : 0
  }
  return sorted
}

export function computeMonthlySummary(rows: WeeklyRow[]): MonthlySummaryRow[] {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const monthMap: Record<string, MonthlySummaryRow> = {}
  for (const r of rows) {
    if (!r.week_start) continue
    const d = new Date(r.week_start)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!monthMap[key]) {
      monthMap[key] = {
        month: MONTHS[d.getMonth()],
        year: d.getFullYear(),
        shift_a: 0,
        shift_b: 0,
        shift_c: 0,
        total: 0,
        total_lub: 0,
        mom_change: 0,
        mom_pct: 0,
      }
    }
    const m = monthMap[key]
    if (r.shift === 'A') m.shift_a += r.fuel_sales_litres
    else if (r.shift === 'B') m.shift_b += r.fuel_sales_litres
    else if (r.shift === 'C') m.shift_c += r.fuel_sales_litres
    m.total += r.fuel_sales_litres
    m.total_lub += r.lub_qty
  }

  const sorted = Object.values(monthMap).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)
  })
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].total
    const curr = sorted[i].total
    sorted[i].mom_change = curr - prev
    sorted[i].mom_pct = prev > 0 ? ((curr - prev) / prev) * 100 : 0
  }
  return sorted
}
