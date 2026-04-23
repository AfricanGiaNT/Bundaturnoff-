'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { NotificationPanel } from '@/components/layout/NotificationPanel'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { KanbanBoard, EntityFilter } from '@/components/work/KanbanBoard'
import { WorkItemDialog } from '@/components/work/WorkItemDialog'
import type { WorkItem } from '@/components/work/WorkItemCard'
import { isManagerLevel } from '@/lib/roles'

interface CurrentUser {
  id: number
  role: string
  display_name: string
  username: string
  entity?: string | null
}

interface User {
  id: number
  display_name: string
  role: string
  is_active: boolean
  username: string
}

export default function KanbanPage() {
  const [currentUser, setCurrentUser]     = useState<CurrentUser | null>(null)
  const [workItems, setWorkItems]         = useState<WorkItem[]>([])
  const [users, setUsers]                 = useState<User[]>([])
  const [workDialogOpen, setWorkDialogOpen] = useState(false)
  const [editingItem, setEditingItem]     = useState<WorkItem | null>(null)
  const [entityFilter, setEntityFilter]   = useState<EntityFilter>('ALL')

  const isManager = currentUser ? isManagerLevel(currentUser.role) : false

  const loadWorkItems = useCallback(async () => {
    const res = await fetch('/api/work-items')
    if (res.ok) {
      const json = await res.json()
      setWorkItems(json.data)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const [meRes, usersRes, itemsRes] = await Promise.all([
        fetch('/api/auth'),
        fetch('/api/users'),
        fetch('/api/work-items'),
      ])
      if (meRes.ok) setCurrentUser((await meRes.json()).data)
      if (usersRes.ok) setUsers((await usersRes.json()).data ?? [])
      if (itemsRes.ok) setWorkItems((await itemsRes.json()).data)
    }
    init()
  }, [])

  function openWorkDialog(item?: WorkItem) {
    setEditingItem(item ?? null)
    setWorkDialogOpen(true)
  }

  return (
    <div>
      <Header title="Kanban Board">
        <NotificationPanel />
      </Header>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          {isManager && (
            <Button onClick={() => openWorkDialog()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Item
            </Button>
          )}
          <Select value={entityFilter} onValueChange={(v) => v && setEntityFilter(v as EntityFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Entities</SelectItem>
              <SelectItem value="FUEL_STATION">Fuel Station</SelectItem>
              <SelectItem value="CONSTRUCTION">Construction</SelectItem>
              <SelectItem value="BOTH">Both / Shared</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <KanbanBoard
          items={workItems}
          users={users}
          isManager={isManager}
          entityFilter={entityFilter}
          onUpdate={loadWorkItems}
          onEdit={openWorkDialog}
          onAddClick={() => openWorkDialog()}
        />
      </div>

      <WorkItemDialog
        open={workDialogOpen}
        item={editingItem}
        users={users}
        onClose={() => setWorkDialogOpen(false)}
        onSave={loadWorkItems}
      />
    </div>
  )
}
