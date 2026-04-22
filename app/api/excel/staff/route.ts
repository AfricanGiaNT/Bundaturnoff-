import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncToExcel } from '@/lib/sync'

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const staff = await prisma.staffRegistry.findMany({
      orderBy: [{ shift: 'asc' }, { attendant_id: 'asc' }],
    })
    return NextResponse.json(
      staff.map((s) => ({
        attendant_id: s.attendant_id,
        attendant_name: s.attendant_name,
        shift: s.shift,
        role: s.role,
        start_date: toDateStr(s.start_date),
        status: s.status,
      }))
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const existing = await prisma.staffRegistry.findUnique({
      where: { attendant_id: body.attendant_id },
    })
    if (existing) {
      return NextResponse.json({ error: 'Attendant ID already exists' }, { status: 400 })
    }
    await prisma.staffRegistry.create({
      data: {
        attendant_id: body.attendant_id,
        attendant_name: body.attendant_name,
        shift: body.shift,
        role: body.role,
        start_date: new Date(body.start_date),
        status: body.status || 'Active',
      },
    })
    syncToExcel()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add staff member' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    await prisma.staffRegistry.update({
      where: { attendant_id: body.attendant_id },
      data: {
        attendant_name: body.attendant_name,
        shift: body.shift,
        role: body.role,
        start_date: new Date(body.start_date),
        status: body.status,
      },
    })
    syncToExcel()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 })
  }
}
