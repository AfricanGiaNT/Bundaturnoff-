import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')?.trim()
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '30', 10)))

  const where = month ? { sheet_month: month } : {}

  const [transactions, agg] = await Promise.all([
    prisma.pOSTransaction.findMany({
      where,
      orderBy: { datetime_local: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        card_number: true,
        card_last4: true,
        amount: true,
        datetime_local: true,
        datetime_gmt: true,
        terminal_id: true,
        switch_key: true,
        account_no: true,
        sheet_month: true,
      },
    }),
    prisma.pOSTransaction.aggregate({
      where,
      _count: { id: true },
      _sum: { amount: true },
    }),
  ])

  return NextResponse.json({
    transactions: transactions.map((t) => ({
      ...t,
      datetime_local: t.datetime_local.toISOString(),
      datetime_gmt: t.datetime_gmt.toISOString(),
    })),
    total: agg._count.id,
    total_amount: agg._sum.amount ?? 0,
    offset,
    limit,
  })
}
