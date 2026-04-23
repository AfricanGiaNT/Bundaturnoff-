import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, unauthorizedResponse } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

    const [notifications, unread_count] = await Promise.all([
      prisma.notification.findMany({
        where: { user_id: session.userId },
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { user_id: session.userId, read: false } }),
    ])

    return NextResponse.json({ data: { unread_count, notifications } })
  } catch {
    return unauthorizedResponse()
  }
}
