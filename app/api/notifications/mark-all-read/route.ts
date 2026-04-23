import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    await prisma.notification.updateMany({
      where: { user_id: session.userId, read: false },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return unauthorizedResponse()
  }
}
