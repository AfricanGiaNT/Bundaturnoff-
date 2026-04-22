import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const month = searchParams.get('month')?.trim()

  const where = month ? { sheet_month: month } : {}

  const grouped = await prisma.pOSTransaction.groupBy({
    by: ['card_number', 'card_last4'],
    where,
    _count: { id: true },
    _sum: { amount: true },
    _min: { datetime_local: true },
    _max: { datetime_local: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  })

  const customers = grouped.map((g) => ({
    card_number: g.card_number,
    card_last4: g.card_last4,
    transaction_count: g._count.id,
    total_amount: g._sum.amount ?? 0,
    first_seen: g._min.datetime_local?.toISOString() ?? '',
    last_seen: g._max.datetime_local?.toISOString() ?? '',
  }))

  return NextResponse.json(customers)
}
