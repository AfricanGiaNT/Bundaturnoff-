'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/roles'
import { KPI_WEIGHTS } from '@/lib/kpi-weights'
import { KPIBreakdown } from './KPIBreakdown'

export interface KPIRecord {
  id: number
  user_id: number
  month: number
  year: number
  attendance_rate: number | null
  target_attendance_rate: number | null
  leave_days_taken: number | null
  target_leave_days_taken: number | null
  disciplinary_count: number | null
  target_disciplinary_count: number | null
  reports_submitted_on_time: number | null
  target_reports_submitted: number | null
  reconciliation_accuracy: number | null
  target_reconciliation_accuracy: number | null
  invoices_processed: number | null
  target_invoices_processed: number | null
  stock_accuracy_pct: number | null
  target_stock_accuracy_pct: number | null
  shrinkage_losses: number | null
  target_shrinkage_losses: number | null
  stock_takes_completed: number | null
  target_stock_takes_completed: number | null
  team_task_completion_rate: number | null
  target_task_completion_rate: number | null
  staff_performance_score: number | null
  target_staff_performance: number | null
  revenue_vs_target: number | null
  target_revenue_vs_target: number | null
  overall_score: number | null
  rating_band: string | null
  bonus_earned: number | null
  kpi_schedule_signed: boolean
  signed_date: string | null
  evidence_notes: Record<string, string> | null
  user: { id: number; display_name: string; role: string }
}

interface Props {
  record: KPIRecord
  isManager: boolean
  has_active_pip?: boolean
  onEdit: () => void
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  OPERATIONS_DIRECTOR:     'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  FUEL_MANAGER:            'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  CONSTRUCTION_COORDINATOR:'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  HR:                      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  ACCOUNTANT:              'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  QA:                      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  WAREHOUSE:               'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  PUMP_ATTENDANT:          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  SITE_WORKER:             'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  // Legacy
  Manager:     'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  Accountant:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  StorageClerk:'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

const RATING_BAND_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  EXCEPTIONAL:   { bg: 'bg-green-100 dark:bg-green-900/20',  text: 'text-green-700 dark:text-green-400',  label: 'Exceptional' },
  ON_TARGET:     { bg: 'bg-green-50 dark:bg-green-900/10',   text: 'text-green-600 dark:text-green-500',  label: 'On Target' },
  BELOW_TARGET:  { bg: 'bg-amber-50 dark:bg-amber-900/10',   text: 'text-amber-700 dark:text-amber-400',  label: 'Below Target' },
  UNSATISFACTORY:{ bg: 'bg-red-50 dark:bg-red-900/10',       text: 'text-destructive',                    label: 'Unsatisfactory' },
}

function scoreColor(value: number, target: number, lowerIsBetter = false): string {
  const pct = lowerIsBetter ? (target / value) * 100 : (value / target) * 100
  if (pct >= 100) return 'text-green-600 dark:text-green-400'
  if (pct >= 80)  return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}

function dotColor(value: number, target: number, lowerIsBetter = false): string {
  const pct = lowerIsBetter ? (target / value) * 100 : (value / target) * 100
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 80)  return 'bg-amber-500'
  return 'bg-destructive'
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function KPIScorecard({ record, isManager, has_active_pip, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false)
  const role     = record.user.role
  const metrics  = KPI_WEIGHTS[role] ?? []
  const band     = record.rating_band ? RATING_BAND_STYLES[record.rating_band] : null
  const rec      = record as unknown as Record<string, unknown>

  const breakdownRows = metrics.map((m) => ({
    label:         m.label,
    weight:        m.weight,
    actual:        rec[m.valueField] as number | null,
    target:        rec[m.targetField] as number | null,
    lowerIsBetter: m.lowerIsBetter,
    unit:          m.unit,
    evidence_note: record.evidence_notes?.[m.valueField] ?? null,
  }))

  return (
    <Card className={band ? `${band.bg}` : ''}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold leading-tight truncate">{record.user.display_name}</p>
              {has_active_pip && (
                <Badge className="text-[10px] h-5 bg-destructive/10 text-destructive border-0 shrink-0">PIP Active</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${ROLE_BADGE_COLORS[role] ?? ''}`}>
                {ROLE_LABELS[role] ?? role}
              </span>
              <span className="text-xs text-muted-foreground">
                {MONTHS[record.month - 1]} {record.year}
              </span>
              {record.kpi_schedule_signed && (
                <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" /> Signed
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {record.overall_score != null && band && (
              <div className="text-right">
                <p className={`text-lg font-bold leading-none ${band.text}`}>
                  {record.overall_score.toFixed(0)}
                </p>
                <p className={`text-[10px] font-medium ${band.text}`}>{band.label}</p>
              </div>
            )}
            {isManager && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {metrics.length === 0 ? (
          <p className="text-xs text-muted-foreground">No metrics defined for this role.</p>
        ) : (
          metrics.map((m) => {
            const val    = rec[m.valueField] as number | null
            const target = rec[m.targetField] as number | null
            return (
              <div key={m.label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground flex-1 truncate">{m.label}</span>
                {val != null && target != null ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs font-medium ${scoreColor(val, target, m.lowerIsBetter)}`}>
                      {val}{m.unit ?? ''} / {target}{m.unit ?? ''}
                    </span>
                    <span className={`h-2 w-2 rounded-full ${dotColor(val, target, m.lowerIsBetter)}`} />
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-5">No data</Badge>
                )}
              </div>
            )
          })
        )}

        {metrics.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-6 text-xs text-muted-foreground mt-1"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
            {expanded ? 'Hide breakdown' : 'Show breakdown'}
          </Button>
        )}

        {expanded && <KPIBreakdown rows={breakdownRows} />}

        {record.bonus_earned != null && record.bonus_earned > 0 && (
          <div className="pt-2 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Bonus Earned</span>
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">
              ${record.bonus_earned.toLocaleString()}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
