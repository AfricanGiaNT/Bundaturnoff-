import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse } from '@/lib/session'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(req)
    const { id } = await params
    const notifId = parseInt(id)
    if (isNaN(notifId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    await prisma.notification.updateMany({
      where: { id: notifId, user_id: session.userId },
      data: { read: true },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return unauthorizedResponse()
  }
}
