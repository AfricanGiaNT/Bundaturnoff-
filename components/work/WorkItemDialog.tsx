'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface WorkItemFormData {
  title: string
  description: string
  type: string
  priority: string
  entity: string
  escalation_note: string
  due_date: string
  assigned_to_id: number | null
  blocked: boolean
}

interface WorkItem {
  id: number
  title: string
  description: string
  type: string
  priority: string
  status: string
  entity: string
  escalation_note?: string | null
  due_date: string | null
  assigned_to: { id: number; display_name: string } | null
}

interface User {
  id: number
  display_name: string
  role: string
  is_active: boolean
}

interface Props {
  open: boolean
  item: WorkItem | null
  users: User[]
  onClose: () => void
  onSave: () => void
}

const EMPTY: WorkItemFormData = {
  title: '',
  description: '',
  type: 'TASK',
  priority: 'MEDIUM',
  entity: 'BOTH',
  escalation_note: '',
  due_date: '',
  assigned_to_id: null,
  blocked: false,
}

export function WorkItemDialog({ open, item, users, onClose, onSave }: Props) {
  const [form, setForm] = useState<WorkItemFormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (item) {
        setForm({
          title:           item.title,
          description:     item.description,
          type:            item.type,
          priority:        item.priority,
          entity:          item.entity ?? 'BOTH',
          escalation_note: item.escalation_note ?? '',
          due_date:        item.due_date ? item.due_date.split('T')[0] : '',
          assigned_to_id:  item.assigned_to?.id ?? null,
          blocked:         item.status === 'BLOCKED',
        })
      } else {
        setForm(EMPTY)
      }
      setError('')
    }
  }, [open, item])

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        title:           form.title.trim(),
        description:     form.description.trim(),
        type:            form.type,
        priority:        form.priority,
        entity:          form.entity,
        due_date:        form.due_date || null,
        assigned_to_id:  form.assigned_to_id,
      }
      if (form.blocked || (item && item.status === 'BLOCKED')) {
        body.status          = 'BLOCKED'
        body.escalation_note = form.escalation_note.trim() || null
      } else if (item) {
        body.escalation_note = null
      }
      const url    = item ? `/api/work-items/${item.id}` : '/api/work-items'
      const method = item ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to save')
        return
      }
      onSave()
      onClose()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const activeUsers = users.filter((u) => u.is_active)
  const showEscalation = form.blocked || (item?.status === 'BLOCKED')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Work Item' : 'New Work Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wi-title">Title</Label>
            <Input
              id="wi-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Complete monthly payroll"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wi-desc">Description</Label>
            <textarea
              id="wi-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="Optional details..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TASK">Office Task</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="MEETING">Meeting / Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => v && setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Entity</Label>
            <Select value={form.entity} onValueChange={(v) => v && setForm((f) => ({ ...f, entity: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BOTH">Both Entities</SelectItem>
                <SelectItem value="FUEL_STATION">Fuel Station</SelectItem>
                <SelectItem value="CONSTRUCTION">Construction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!item && (
            <div className="flex items-center gap-2">
              <input
                id="wi-blocked"
                type="checkbox"
                checked={form.blocked}
                onChange={(e) => setForm((f) => ({ ...f, blocked: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="wi-blocked" className="cursor-pointer">Mark as Escalated / Blocked</Label>
            </div>
          )}
          {showEscalation && (
            <div className="space-y-2">
              <Label htmlFor="wi-escalation">Escalation Note</Label>
              <textarea
                id="wi-escalation"
                value={form.escalation_note}
                onChange={(e) => setForm((f) => ({ ...f, escalation_note: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-destructive/40 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Describe what's blocking this item and what decision is needed..."
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="wi-due">Due Date</Label>
            <Input
              id="wi-due"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select
              value={form.assigned_to_id?.toString() ?? 'none'}
              onValueChange={(v) => v && setForm((f) => ({ ...f, assigned_to_id: v === 'none' ? null : parseInt(v) }))}
            >
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {activeUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.display_name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
