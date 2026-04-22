import { NextResponse } from 'next/server'
import { prisma, type DbSalesRow } from '@/lib/db'
import { computeWeeklySummary } from '@/lib/compute'
import { WeeklyRow } from '@/lib/types'

function toDateStr(d: Date): string { return d.toISOString().split('T')[0] }

export async function GET() {
  try {
    const salesRows = await prisma.weeklySales.findMany({ orderBy: { week_start: 'asc' } })
    const rows: WeeklyRow[] = salesRows.map((r: DbSalesRow) => ({ week_start: toDateStr(r.week_start), week_end: toDateStr(r.week_end), shift: r.shift, attendant_id: r.attendant_id, attendant_name: '', role: '', fuel_sales_litres: r.fuel_sales_litres, lub_qty: r.lub_qty, notes: r.notes }))
    return NextResponse.json(computeWeeklySummary(rows))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to compute weekly summary' }, { status: 500 })
  }
}
