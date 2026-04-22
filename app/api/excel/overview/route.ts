import { NextResponse } from 'next/server'
import { prisma, type DbStaffRow, type DbSalesRow } from '@/lib/db'
import { computeOverview } from '@/lib/compute'
import { StaffMember, WeeklyRow } from '@/lib/types'

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const [staffRows, salesRows] = await Promise.all([
      prisma.staffRegistry.findMany({ orderBy: { attendant_id: 'asc' } }),
      prisma.weeklySales.findMany({ orderBy: { week_start: 'asc' } }),
    ])

    const staff: StaffMember[] = staffRows.map((s: DbStaffRow) => ({
      attendant_id: s.attendant_id,
      attendant_name: s.attendant_name,
      shift: s.shift,
      role: s.role,
      start_date: toDateStr(s.start_date),
      status: s.status,
    }))

    const rows: WeeklyRow[] = salesRows.map((r: DbSalesRow) => ({
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

    return NextResponse.json(computeOverview(rows, staff))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 })
  }
}
