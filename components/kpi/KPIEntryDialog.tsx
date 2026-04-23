'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { KPIRecord } from './KPIScorecard'

interface User {
  id: number
  display_name: string
  role: string
  is_active: boolean
}

interface Props {
  open: boolean
  record: KPIRecord | null
  users: User[]
  defaultMonth: number
  defaultYear: number
  preselectedUserId?: number
  onClose: () => void
  onSave: () => void
}

type FormFields = Record<string, string>

const METRIC_FIELDS: Record<string, { valueKey: string; targetKey: string; label: string; unit?: string }[]> = {
  HR: [
    { valueKey: 'attendance_rate',    targetKey: 'target_attendance_rate',    label: 'Attendance Rate', unit: '%' },
    { valueKey: 'leave_days_taken',   targetKey: 'target_leave_days_taken',   label: 'Leave Days Taken' },
    { valueKey: 'disciplinary_count', targetKey: 'target_disciplinary_count', label: 'Disciplinary Count' },
  ],
  ACCOUNTANT: [
    { valueKey: 'reports_submitted_on_time',  targetKey: 'target_reports_submitted',       label: 'Reports On Time' },
    { valueKey: 'reconciliation_accuracy',    targetKey: 'target_reconciliation_accuracy', label: 'Reconciliation Accuracy', unit: '%' },
    { valueKey: 'invoices_processed',         targetKey: 'target_invoices_processed',      label: 'Invoices Processed' },
  ],
  WAREHOUSE: [
    { valueKey: 'stock_accuracy_pct',    targetKey: 'target_stock_accuracy_pct',    label: 'Stock Accuracy', unit: '%' },
    { valueKey: 'shrinkage_losses',      targetKey: 'target_shrinkage_losses',      label: 'Shrinkage Losses' },
    { valueKey: 'stock_takes_completed', targetKey: 'target_stock_takes_completed', label: 'Stock Takes Completed' },
  ],
  MANAGER: [
    { valueKey: 'team_task_completion_rate', targetKey: 'target_task_completion_rate', label: 'Task Completion Rate', unit: '%' },
    { valueKey: 'staff_performance_score',   targetKey: 'target_staff_performance',    label: 'Staff Performance Score' },
    { valueKey: 'revenue_vs_target',         targetKey: 'target_revenue_vs_target',    label: 'Revenue vs Target', unit: '%' },
  ],
}

// Map role to metric group key
function getMetricGroupKey(role: string): string {
  if (role === 'HR') return 'HR'
  if (role === 'ACCOUNTANT' || role === 'Accountant') return 'ACCOUNTANT'
  if (role === 'WAREHOUSE' || role === 'StorageClerk' || role === 'QA' || role === 'PUMP_ATTENDANT' || role === 'SITE_WORKER') return 'WAREHOUSE'
  if (role === 'OPERATIONS_DIRECTOR' || role === 'FUEL_MANAGER' || role === 'CONSTRUCTION_COORDINATOR' || role === 'Manager') return 'MANAGER'
  return ''
}

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

export function KPIEntryDialog({ open, record, users, defaultMonth, defaultYear, preselectedUserId, onClose, onSave }: Props) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [month, setMonth]     = useState(defaultMonth)
  const [year, setYear]       = useState(defaultYear)
  const [fields, setFields]   = useState<FormFields>({})
  const [evidenceNotes, setEvidenceNotes] = useState<Record<string, string>>({})
  const [bonusEarned, setBonusEarned]     = useState('')
  const [kpiSigned, setKpiSigned]         = useState(false)
  const [signedDate, setSignedDate]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [showEvidence, setShowEvidence]   = useState(false)

  const activeUsers  = users.filter((u) => u.is_active)
  const selectedUser = activeUsers.find((u) => u.id.toString() === selectedUserId)
  const groupKey     = getMetricGroupKey(selectedUser?.role ?? '')
  const roleFields   = METRIC_FIELDS[groupKey] ?? []

  useEffect(() => {
    if (!open) return
    if (record) {
      setSelectedUserId(record.user_id.toString())
      setMonth(record.month)
      setYear(record.year)
      setBonusEarned(record.bonus_earned != null ? String(record.bonus_earned) : '')
      setKpiSigned(record.kpi_schedule_signed)
      setSignedDate(record.signed_date ? record.signed_date.split('T')[0] : '')
      setEvidenceNotes(record.evidence_notes ?? {})
      const init: FormFields = {}
      const allKeys = Object.values(METRIC_FIELDS).flat().flatMap((f) => [f.valueKey, f.targetKey])
      for (const k of allKeys) {
        const v = (record as unknown as Record<string, unknown>)[k]
        init[k] = v != null ? String(v) : ''
      }
      setFields(init)
    } else {
      setSelectedUserId(preselectedUserId != null ? preselectedUserId.toString() : '')
      setMonth(defaultMonth)
      setYear(defaultYear)
      setFields({})
      setEvidenceNotes({})
      setBonusEarned('')
      setKpiSigned(false)
      setSignedDate('')
    }
    setError('')
    setShowEvidence(false)
  }, [open, record, defaultMonth, defaultYear, preselectedUserId])

  function setField(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!selectedUserId) { setError('Select an employee'); return }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = { user_id: parseInt(selectedUserId), month, year }
      for (const f of roleFields) {
        body[f.valueKey]  = fields[f.valueKey]  !== '' && fields[f.valueKey]  != null ? parseFloat(fields[f.valueKey])  : null
        body[f.targetKey] = fields[f.targetKey] !== '' && fields[f.targetKey] != null ? parseFloat(fields[f.targetKey]) : null
      }
      body.bonus_earned        = bonusEarned !== '' ? parseFloat(bonusEarned) : null
      body.kpi_schedule_signed = kpiSigned
      body.signed_date         = kpiSigned && signedDate ? signedDate : null
      body.evidence_notes      = Object.keys(evidenceNotes).length > 0 ? evidenceNotes : null

      const res = await fetch('/api/kpi', {
        method: 'POST',
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

  const currentYear  = new Date().getFullYear()
  const yearOptions  = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? 'Edit KPI Entry' : 'Add KPI Entry'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={selectedUserId} onValueChange={(v) => v && setSelectedUserId(v)} disabled={!!record}>
              <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
              <SelectContent>
                {activeUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.display_name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month.toString()} onValueChange={(v) => v && setMonth(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={year.toString()} onValueChange={(v) => v && setYear(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {roleFields.length === 0 && selectedUser && (
            <p className="text-sm text-muted-foreground">No KPI fields defined for this role.</p>
          )}

          {roleFields.map((f) => (
            <div key={f.valueKey} className="space-y-2">
              <Label>{f.label}{f.unit ? ` (${f.unit})` : ''}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Actual</p>
                  <Input
                    type="number" min={0} step="any"
                    value={fields[f.valueKey] ?? ''}
                    onChange={(e) => setField(f.valueKey, e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Target</p>
                  <Input
                    type="number" min={0} step="any"
                    value={fields[f.targetKey] ?? ''}
                    onChange={(e) => setField(f.targetKey, e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          ))}

          {roleFields.length > 0 && (
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Metadata</p>
              <div className="space-y-2">
                <Label htmlFor="bonus-earned">Bonus Earned</Label>
                <Input
                  id="bonus-earned"
                  type="number" min={0} step="any"
                  value={bonusEarned}
                  onChange={(e) => setBonusEarned(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="kpi-signed"
                  type="checkbox"
                  checked={kpiSigned}
                  onChange={(e) => setKpiSigned(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="kpi-signed" className="cursor-pointer">KPI Schedule Signed</Label>
              </div>
              {kpiSigned && (
                <div className="space-y-2">
                  <Label htmlFor="signed-date">Signed Date</Label>
                  <Input
                    id="signed-date"
                    type="date"
                    value={signedDate}
                    onChange={(e) => setSignedDate(e.target.value)}
                  />
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setShowEvidence((v) => !v)}
              >
                {showEvidence ? '▾ Hide' : '▸ Add'} evidence notes
              </Button>
              {showEvidence && roleFields.map((f) => (
                <div key={`ev-${f.valueKey}`} className="space-y-1">
                  <Label className="text-xs">{f.label} — Evidence</Label>
                  <Input
                    type="text"
                    value={evidenceNotes[f.valueKey] ?? ''}
                    onChange={(e) => setEvidenceNotes((n) => ({ ...n, [f.valueKey]: e.target.value }))}
                    placeholder="e.g. Verified via timesheets"
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !selectedUserId}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
