import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KPIScorecard, KPIRecord } from './KPIScorecard'

interface User {
  id: number
  display_name: string
  role: string
  is_active: boolean
}

interface PIPRecord {
  id: number
  user_id: number
  status: string
}

interface Props {
  records: KPIRecord[]
  users: User[]
  isManager: boolean
  pips?: PIPRecord[]
  onEdit: (record: KPIRecord) => void
  onAddForUser?: (userId: number) => void
}

export function KPIScorecardGrid({ records, users, isManager, pips = [], onEdit, onAddForUser }: Props) {
  const activePipUserIds = new Set(pips.filter((p) => p.status === 'ACTIVE').map((p) => p.user_id))
  const recordedIds      = new Set(records.map((r) => r.user_id))
  const missing          = isManager ? users.filter((u) => u.is_active && !recordedIds.has(u.id)) : []

  if (records.length === 0 && missing.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No KPI records for this period.</p>
        {isManager && <p className="text-muted-foreground text-xs mt-1">Use the &quot;Add KPI Entry&quot; button to add records.</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {records.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {records.map((r) => (
            <KPIScorecard
              key={r.id}
              record={r}
              isManager={isManager}
              has_active_pip={activePipUserIds.has(r.user_id)}
              onEdit={() => onEdit(r)}
            />
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Pending — No KPI Data
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {missing.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border border-dashed p-4 flex flex-col items-center justify-center text-center gap-2 min-h-32"
              >
                <p className="text-sm font-medium text-muted-foreground">{u.display_name}</p>
                <p className="text-xs text-muted-foreground">{u.role.replace(/_/g, ' ')}</p>
                {activePipUserIds.has(u.id) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">PIP Active</span>
                )}
                {isManager && onAddForUser && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs mt-1"
                    onClick={() => onAddForUser(u.id)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add KPI
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
