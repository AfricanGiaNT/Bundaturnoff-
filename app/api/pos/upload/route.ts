import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parsePOSExcel } from '@/lib/parse-pos'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await (file as File).arrayBuffer())
    const transactions = parsePOSExcel(buffer)

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No valid transactions found in file' }, { status: 400 })
    }

    const result = await prisma.pOSTransaction.createMany({
      data: transactions.map((tx) => ({
        card_number: tx.card_number,
        card_last4: tx.card_last4,
        amount: tx.amount,
        datetime_local: tx.datetime_local,
        datetime_gmt: tx.datetime_gmt,
        terminal_id: tx.terminal_id,
        switch_key: tx.switch_key,
        account_no: tx.account_no,
        sheet_month: tx.sheet_month,
      })),
      skipDuplicates: true,
    })

    const imported = result.count
    const skipped = transactions.length - result.count
    const months = [...new Set(transactions.map((t) => t.sheet_month))].sort()

    return NextResponse.json({ imported, skipped, months })
  } catch (err) {
    console.error('POS upload error:', err)
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 })
  }
}
