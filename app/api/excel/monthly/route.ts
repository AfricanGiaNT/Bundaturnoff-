import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeMonthlySummary } from '@/lib/compute'
import { WeeklyRow } from '@/lib/types'

function toDateStr(d: Date): string { return d.toISOString().split('T')[0] }

export async function GET() {
  try {
    const salesRows = await prisma.weeklySales.findMany({ orderBy: { week_start: 'asc' } })
    const rows: WeeklyRow[] = salesRows.map((r) => ({ week_start: toDateStr(r.week_start), week_end: toDateStr(r.week_end), shift: r.shift, attendant_id: r.attendant_id, attendant_name: '', role: '', fuel_sales_litres: r.fuel_sales_litres, lub_qty: r.lub_qty, notes: r.notes }))
    return NextResponse.json(computeMonthlySummary(rows))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to compute monthly summary' }, { status: 500 })
  }
}
