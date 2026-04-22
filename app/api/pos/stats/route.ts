import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const [agg, monthGroups, uniqueCardGroups] = await Promise.all([
    prisma.pOSTransaction.aggregate({
      _count: { id: true },
      _sum: { amount: true },
      _min: { datetime_local: true },
      _max: { datetime_local: true },
    }),
    prisma.pOSTransaction.groupBy({
      by: ['sheet_month'],
      _count: { id: true },
    }),
    prisma.pOSTransaction.groupBy({
      by: ['card_number'],
    }),
  ])

  const months = monthGroups
    .map((m) => m.sheet_month)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  return NextResponse.json({
    total_count: agg._count.id,
    total_amount: agg._sum.amount ?? 0,
    unique_cards: uniqueCardGroups.length,
    date_from: agg._min.datetime_local?.toISOString() ?? null,
    date_to: agg._max.datetime_local?.toISOString() ?? null,
    months,
    month_counts: Object.fromEntries(monthGroups.map((m) => [m.sheet_month, m._count.id])),
  })
}
