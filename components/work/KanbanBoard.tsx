import { KanbanColumn } from './KanbanColumn'
import { WorkItem } from './WorkItemCard'

interface User {
  id: number
  display_name: string
  role: string
  is_active: boolean
}

export type EntityFilter = 'ALL' | 'FUEL_STATION' | 'CONSTRUCTION' | 'BOTH'

interface Props {
  items: WorkItem[]
  users: User[]
  isManager: boolean
  entityFilter?: EntityFilter
  onUpdate: () => void
  onEdit: (item: WorkItem) => void
  onAddClick: () => void
}

export function KanbanBoard({ items, users, isManager, entityFilter = 'ALL', onUpdate, onEdit, onAddClick }: Props) {
  const filtered = entityFilter === 'ALL'
    ? items
    : items.filter((i) => i.entity === entityFilter || i.entity === 'BOTH')

  const todo       = filtered.filter((i) => i.status === 'TODO')
  const inProgress = filtered.filter((i) => i.status === 'IN_PROGRESS')
  const done       = filtered.filter((i) => i.status === 'DONE')
  const blocked    = filtered.filter((i) => i.status === 'BLOCKED')

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KanbanColumn
        status="TODO"
        items={todo}
        users={users}
        isManager={isManager}
        onUpdate={onUpdate}
        onEdit={onEdit}
        onAddClick={onAddClick}
      />
      <KanbanColumn
        status="IN_PROGRESS"
        items={inProgress}
        users={users}
        isManager={isManager}
        onUpdate={onUpdate}
        onEdit={onEdit}
      />
      <KanbanColumn
        status="DONE"
        items={done}
        users={users}
        isManager={isManager}
        onUpdate={onUpdate}
        onEdit={onEdit}
      />
      <KanbanColumn
        status="BLOCKED"
        items={blocked}
        users={users}
        isManager={isManager}
        onUpdate={onUpdate}
        onEdit={onEdit}
      />
    </div>
  )
}
