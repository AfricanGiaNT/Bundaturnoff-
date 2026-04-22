import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeMonthlySummary, computeIndividual } from '@/lib/compute'
import { WeeklyRow, StaffMember } from '@/lib/types'

function toDateStr(d: Date): string { return d.toISOString().split('T')[0] }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // e.g. "April"
  const year = searchParams.get('year')   // e.g. "2026"

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

    const monthlySummary = computeMonthlySummary(allRows)

    // Filter to requested month/year if specified
    let filtered = monthlySummary
    if (month && year) {
      filtered = monthlySummary.filter(
        (m) => m.month === month && m.year === Number(year)
      )
    }

    // Individual performance for the filtered period
    const filteredRows = (month && year)
      ? allRows.filter((r) => {
          const d = new Date(r.week_start)
          const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
          return MONTHS[d.getMonth()] === month && d.getFullYear() === Number(year)
        })
      : allRows

    const individual = computeIndividual(filteredRows, staff)

    return NextResponse.json({ monthly: filtered, individual, staff, allMonths: monthlySummary })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
