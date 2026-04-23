import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import { WorkItemCard, WorkItem } from './WorkItemCard'

interface User {
  id: number
  display_name: string
  role: string
  is_active: boolean
}

interface Props {
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'
  items: WorkItem[]
  users: User[]
  isManager: boolean
  onUpdate: () => void
  onEdit: (item: WorkItem) => void
  onAddClick?: () => void
}

const COLUMN_LABELS = {
  TODO:        'To Do',
  IN_PROGRESS: 'In Progress',
  DONE:        'Done',
  BLOCKED:     'Blocked / Escalated',
}
const COLUMN_COLORS = {
  TODO:        'bg-slate-100 dark:bg-slate-800/50',
  IN_PROGRESS: 'bg-blue-50 dark:bg-blue-900/10',
  DONE:        'bg-green-50 dark:bg-green-900/10',
  BLOCKED:     'bg-red-50 dark:bg-red-900/10',
}

export function KanbanColumn({ status, items, users, isManager, onUpdate, onEdit, onAddClick }: Props) {
  return (
    <div className={`rounded-lg p-3 ${COLUMN_COLORS[status]} flex flex-col gap-2 min-h-48`}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{COLUMN_LABELS[status]}</span>
          <Badge variant="secondary" className="text-xs h-5">{items.length}</Badge>
        </div>
        {isManager && status === 'TODO' && onAddClick && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddClick}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2 flex-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No items</p>
        ) : (
          items.map((item) => (
            <WorkItemCard
              key={item.id}
              item={item}
              users={users}
              isManager={isManager}
              onUpdate={onUpdate}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  )
}
