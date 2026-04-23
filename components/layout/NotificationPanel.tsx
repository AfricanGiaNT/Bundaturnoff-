'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface Notification {
  id: number
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20')
      if (!res.ok) return
      const json = await res.json()
      setUnread(json.data.unread_count)
      setNotifications(json.data.notifications)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  async function markRead(id: number) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnread((prev) => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await fetch('/api/notifications/mark-all-read', { method: 'POST' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  const typeBadge: Record<string, string> = {
    TASK_ASSIGNED:       'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    TASK_OVERDUE:        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    KPI_BELOW_THRESHOLD: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    PIP_DUE:             'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    SCORE_DROPPED:       'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
          'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground pointer-events-none">
            {unread > 99 ? '99+' : unread}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
          ) : (
            notifications.map((n, i) => (
              <div key={n.id}>
                <button
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${!n.read ? 'bg-muted/20' : ''}`}
                  onClick={() => { if (!n.read) markRead(n.id) }}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <div className={`flex-1 min-w-0 ${n.read ? 'pl-4' : ''}`}>
                      <p className="text-sm font-medium leading-tight truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeBadge[n.type] ?? ''}`}>
                          {n.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
                {i < notifications.length - 1 && <Separator />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
