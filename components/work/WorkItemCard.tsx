'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash2, AlertTriangle } from 'lucide-react'

export interface WorkItem {
  id: number
  title: string
  description: string
  type: string
  status: string
  priority: string
  entity: string
  escalation_note?: string | null
  due_date: string | null
  assigned_to: { id: number; display_name: string; role: string } | null
  created_by: { id: number; display_name: string }
}

interface User {
  id: number
  display_name: string
  role: string
  is_active: boolean
}

interface Props {
  item: WorkItem
  users: User[]
  isManager: boolean
  onUpdate: () => void
  onEdit: (item: WorkItem) => void
}

const TYPE_LABELS: Record<string, string> = { TASK: 'Task', MAINTENANCE: 'Maintenance', MEETING: 'Meeting' }
const TYPE_COLORS: Record<string, string> = {
  TASK:        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  MAINTENANCE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  MEETING:     'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}
const PRIORITY_COLORS: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  LOW:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}
const ENTITY_COLORS: Record<string, string> = {
  FUEL_STATION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  CONSTRUCTION: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
}
const ENTITY_LABELS: Record<string, string> = { FUEL_STATION: 'Fuel', CONSTRUCTION: 'Construction' }

const OTHER_STATUSES: Record<string, { label: string; value: string }[]> = {
  TODO:        [{ label: 'Move to In Progress', value: 'IN_PROGRESS' }, { label: 'Move to Done', value: 'DONE' }, { label: 'Escalate (Block)', value: 'BLOCKED' }],
  IN_PROGRESS: [{ label: 'Move to To Do', value: 'TODO' }, { label: 'Move to Done', value: 'DONE' }, { label: 'Escalate (Block)', value: 'BLOCKED' }],
  DONE:        [{ label: 'Move to To Do', value: 'TODO' }, { label: 'Move to In Progress', value: 'IN_PROGRESS' }],
  BLOCKED:     [{ label: 'Move to In Progress', value: 'IN_PROGRESS' }, { label: 'Move to To Do', value: 'TODO' }, { label: 'Move to Done', value: 'DONE' }],
}

export function WorkItemCard({ item, isManager, onUpdate, onEdit }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [moving, setMoving] = useState(false)

  const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== 'DONE'
  const isBlocked = item.status === 'BLOCKED'

  async function moveStatus(newStatus: string | null) {
    if (!newStatus) return
    setMoving(true)
    try {
      await fetch(`/api/work-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      onUpdate()
    } finally {
      setMoving(false)
    }
  }

  async function handleDelete() {
    await fetch(`/api/work-items/${item.id}`, { method: 'DELETE' })
    onUpdate()
  }

  const dueDateStr = item.due_date
    ? new Date(item.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <Card className={`shadow-sm ${isBlocked ? 'border-destructive/40' : ''}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug flex-1">{item.title}</p>
          <div className="flex flex-col items-end gap-1">
            {isBlocked && (
              <Badge className="shrink-0 text-[10px] bg-destructive/10 text-destructive border-0 flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Escalated
              </Badge>
            )}
            {isOverdue && !isBlocked && (
              <Badge className="shrink-0 text-[10px] bg-destructive/10 text-destructive border-0">Overdue</Badge>
            )}
          </div>
        </div>

        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}

        {isBlocked && item.escalation_note && (
          <p className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1 leading-snug">
            {item.escalation_note}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[item.type] ?? ''}`}>
            {TYPE_LABELS[item.type] ?? item.type}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[item.priority] ?? ''}`}>
            {item.priority}
          </span>
          {item.entity && item.entity !== 'BOTH' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ENTITY_COLORS[item.entity] ?? ''}`}>
              {ENTITY_LABELS[item.entity] ?? item.entity}
            </span>
          )}
        </div>

        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {item.assigned_to && <p>Assigned: {item.assigned_to.display_name}</p>}
          {dueDateStr && <p>Due: {dueDateStr}</p>}
        </div>

        {isManager && (
          <div className="flex items-center gap-1 pt-1 border-t">
            <Select onValueChange={moveStatus} disabled={moving}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Move to..." />
              </SelectTrigger>
              <SelectContent>
                {(OTHER_STATUSES[item.status] ?? []).map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {confirmDelete ? (
              <>
                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-xs" onClick={() => setConfirmDelete(false)}>
                  ✕
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
