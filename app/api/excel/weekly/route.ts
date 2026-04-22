import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncToExcel } from '@/lib/sync'
import { WeeklyRow } from '@/lib/types'

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// GET: all rows, or filter by ?week_start=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const weekStart = searchParams.get('week_start')

    const rows = await prisma.weeklySales.findMany({
      where: weekStart ? { week_start: new Date(weekStart) } : undefined,
      orderBy: [{ week_start: 'asc' }, { shift: 'asc' }, { attendant_id: 'asc' }],
      include: { staff: true },
    })

    return NextResponse.json(
      rows.map((r: typeof rows[number]) => ({
        week_start: toDateStr(r.week_start),
        week_end: toDateStr(r.week_end),
        shift: r.shift,
        attendant_id: r.attendant_id,
        attendant_name: r.staff?.attendant_name ?? '',
        role: r.staff?.role ?? '',
        fuel_sales_litres: r.fuel_sales_litres,
        lub_qty: r.lub_qty,
        notes: r.notes,
      }))
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load weekly data' }, { status: 500 })
  }
}

// POST: upsert all rows for a week (replaces existing rows for that week)
export async function POST(req: NextRequest) {
  try {
    const body: { week_start: string; rows: WeeklyRow[] } = await req.json()
    const weekDate = new Date(body.week_start)

    // Upsert each row
    await Promise.all(
      body.rows.map((r) =>
        prisma.weeklySales.upsert({
          where: {
            week_start_attendant_id: {
              week_start: weekDate,
              attendant_id: r.attendant_id,
            },
          },
          create: {
            week_start: weekDate,
            week_end: new Date(r.week_end),
            shift: r.shift,
            attendant_id: r.attendant_id,
            fuel_sales_litres: Number(r.fuel_sales_litres) || 0,
            lub_qty: Number(r.lub_qty) || 0,
            notes: r.notes || '',
          },
          update: {
            week_end: new Date(r.week_end),
            shift: r.shift,
            fuel_sales_litres: Number(r.fuel_sales_litres) || 0,
            lub_qty: Number(r.lub_qty) || 0,
            notes: r.notes || '',
          },
        })
      )
    )

    // Sync back to Excel (non-blocking)
    syncToExcel()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save weekly data' }, { status: 500 })
  }
}

// DELETE: remove a single row
export async function DELETE(req: NextRequest) {
  try {
    const { week_start, attendant_id } = await req.json()
    await prisma.weeklySales.deleteMany({
      where: {
        week_start: new Date(week_start),
        attendant_id,
      },
    })
    syncToExcel()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete row' }, { status: 500 })
  }
}

// PUT: get list of distinct weeks
export async function PUT() {
  try {
    const weeks = await prisma.weeklySales.findMany({
      select: { week_start: true, week_end: true },
      distinct: ['week_start'],
      orderBy: { week_start: 'desc' },
    })
    return NextResponse.json(
      weeks.map((w: typeof weeks[number]) => ({
        week_start: toDateStr(w.week_start),
        week_end: toDateStr(w.week_end),
      }))
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load weeks' }, { status: 500 })
  }
}
