import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const last4 = searchParams.get('last4')?.trim()
  const month = searchParams.get('month')?.trim()

  if (!last4 || !/^\d{4}$/.test(last4)) {
    return NextResponse.json({ error: 'Provide exactly 4 digits' }, { status: 400 })
  }

  const where: { card_last4: string; sheet_month?: string } = { card_last4: last4 }
  if (month) where.sheet_month = month

  const transactions = await prisma.pOSTransaction.findMany({
    where,
    orderBy: { datetime_local: 'desc' },
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
  })

  const total_amount = transactions.reduce((sum, t) => sum + t.amount, 0)

  return NextResponse.json({
    transactions: transactions.map((t) => ({
      ...t,
      datetime_local: t.datetime_local.toISOString(),
      datetime_gmt: t.datetime_gmt.toISOString(),
    })),
    total_count: transactions.length,
    total_amount,
  })
}
