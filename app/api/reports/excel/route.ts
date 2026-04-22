import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeMonthlySummary, computeIndividual, computeShiftSummary } from '@/lib/compute'
import { WeeklyRow, StaffMember } from '@/lib/types'
import * as XLSX from 'xlsx'

function toDateStr(d: Date): string { return d.toISOString().split('T')[0] }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  try {
    const [staffRows, salesRows] = await Promise.all([
      prisma.staffRegistry.findMany({ orderBy: { attendant_id: 'asc' } }),
      prisma.weeklySales.findMany({ orderBy: { week_start: 'asc' } }),
    ])

    const staff: StaffMember[] = staffRows.map((s) => ({
      attendant_id: s.attendant_id,
      attendant_name: s.attendant_name,
      shift: s.shift,
      role: s.role,
      start_date: toDateStr(s.start_date),
      status: s.status,
    }))

    const allRows: WeeklyRow[] = salesRows.map((r) => ({
      week_start: toDateStr(r.week_start),
      week_end: toDateStr(r.week_end),
      shift: r.shift,
      attendant_id: r.attendant_id,
      attendant_name: staffRows.find((s) => s.attendant_id === r.attendant_id)?.attendant_name ?? '',
      role: staffRows.find((s) => s.attendant_id === r.attendant_id)?.role ?? '',
      fuel_sales_litres: r.fuel_sales_litres,
      lub_qty: r.lub_qty,
      notes: r.notes,
    }))

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const filteredRows = (month && year)
      ? allRows.filter((r) => {
          const d = new Date(r.week_start)
          return MONTHS[d.getMonth()] === month && d.getFullYear() === Number(year)
        })
      : allRows

    const wb = XLSX.utils.book_new()
    const label = month && year ? `${month} ${year}` : 'All Time'

    // Sheet 1: Weekly Data
    const weeklyData = filteredRows.map((r) => ({
      'Week Start': r.week_start,
      'Week End': r.week_end,
      'Shift': r.shift,
      'Attendant ID': r.attendant_id,
      'Attendant Name': r.attendant_name,
      'Role': r.role,
      'Fuel Sales (L)': r.fuel_sales_litres,
      'Lub Qty': r.lub_qty,
      'Notes': r.notes,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weeklyData), 'Weekly Data')

    // Sheet 2: Individual Performance
    const individual = computeIndividual(filteredRows, staff)
    const indivData = individual.map((i) => ({
      'Attendant ID': i.attendant_id,
      'Name': i.attendant_name,
      'Shift': i.shift,
      'Role': i.role,
      'Weeks Worked': i.weeks_worked,
      'Total Fuel (L)': +i.total_fuel.toFixed(1),
      'Total Lub': +i.total_lub.toFixed(1),
      'Avg Weekly Fuel (L)': +i.avg_weekly_fuel.toFixed(1),
      'Best Week (L)': +i.best_week_fuel.toFixed(1),
      'Worst Week (L)': +i.worst_week_fuel.toFixed(1),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(indivData), 'Individual Performance')

    // Sheet 3: Monthly Summary
    const monthly = computeMonthlySummary(filteredRows)
    const monthlyData = monthly.map((m) => ({
      'Month': m.month,
      'Year': m.year,
      'Shift A (L)': +m.shift_a.toFixed(1),
      'Shift B (L)': +m.shift_b.toFixed(1),
      'Shift C (L)': +m.shift_c.toFixed(1),
      'Total Fuel (L)': +m.total.toFixed(1),
      'Total Lub': +m.total_lub.toFixed(1),
      'MoM Change (L)': +m.mom_change.toFixed(1),
      'MoM %': +(m.mom_pct).toFixed(1),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyData), 'Monthly Summary')

    // Sheet 4: Shift Summary
    const shiftData = computeShiftSummary(filteredRows, staff).map((s) => ({
      'Shift': s.shift,
      'Total Fuel (L)': +s.total_fuel.toFixed(1),
      'Total Lub': +s.total_lub.toFixed(1),
      'Avg Weekly (L)': +s.avg_weekly.toFixed(1),
      'Active Attendants': s.num_attendants,
      'Best Week (L)': +s.best_week.toFixed(1),
      'Worst Week (L)': +s.worst_week.toFixed(1),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shiftData), 'Shift Summary')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `BundaTurnoff_Report_${label.replace(' ', '_')}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to generate Excel report' }, { status: 500 })
  }
}
