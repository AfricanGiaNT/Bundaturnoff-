'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2, Save, Plus, CalendarDays } from 'lucide-react'
import { WeeklyRow, StaffMember } from '@/lib/types'
import { format, addDays, parseISO } from 'date-fns'

function toWeekEnd(start: string) {
  if (!start) return ''
  return format(addDays(parseISO(start), 6), 'yyyy-MM-dd')
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

interface EditRow extends Partial<WeeklyRow> {
  attendant_id: string
  attendant_name: string
  shift: string
  role: string
  fuel_sales_litres: number
  lub_qty: number
  notes: string
}

export default function WeeklyPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [weeks, setWeeks] = useState<{ week_start: string; week_end: string }[]>([])
  const [selectedWeek, setSelectedWeek] = useState('')
  const [customDate, setCustomDate] = useState('')
  const [rows, setRows] = useState<EditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Load staff and weeks list
  useEffect(() => {
    Promise.all([
      fetch('/api/excel/staff').then((r) => r.json()),
      fetch('/api/excel/weekly', { method: 'PUT' }).then((r) => r.json()),
    ]).then(([staffData, weeksData]) => {
      setStaff(Array.isArray(staffData) ? staffData : [])
      setWeeks(Array.isArray(weeksData) ? weeksData : [])
      setLoading(false)
    }).catch(() => {
      setError('Failed to load data. Check your database connection.')
      setLoading(false)
    })
  }, [])

  const loadWeek = useCallback(async (weekStart: string) => {
    setLoading(true)
    setSelectedWeek(weekStart)
    setError('')
    try {
      const res = await fetch(`/api/excel/weekly?week_start=${weekStart}`)
      const data = await res.json()
      const existing: WeeklyRow[] = Array.isArray(data) ? data : []
      const weekEnd = toWeekEnd(weekStart)

      // Build rows: one per active staff, pre-fill from existing
      const activeStaff = staff.filter((s) => s.status === 'Active')
      const editRows: EditRow[] = activeStaff.map((s) => {
        const found = existing.find((r) => r.attendant_id === s.attendant_id)
        return {
          week_start: weekStart,
          week_end: weekEnd,
          attendant_id: s.attendant_id,
          attendant_name: s.attendant_name,
          shift: s.shift,
          role: s.role,
          fuel_sales_litres: found?.fuel_sales_litres ?? 0,
          lub_qty: found?.lub_qty ?? 0,
          notes: found?.notes ?? '',
        }
      })
      setRows(editRows)
    } catch {
      setError('Failed to load week data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [staff])

  function handleNewWeek() {
    if (!customDate) return
    loadWeek(customDate)
  }

  function updateRow(idx: number, field: keyof EditRow, value: string | number) {
    setRows((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  async function deleteRow(idx: number) {
    const row = rows[idx]
    if (row.week_start) {
      await fetch('/api/excel/weekly', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: row.week_start, attendant_id: row.attendant_id }),
      })
    }
    setRows((prev) => prev.filter((_, i) => i !== idx))
    setMessage('Row removed.')
    setTimeout(() => setMessage(''), 3000)
  }

  async function saveWeek() {
    if (!selectedWeek) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const weekEnd = toWeekEnd(selectedWeek)
      const payload: WeeklyRow[] = rows.map((r) => ({
        week_start: selectedWeek,
        week_end: weekEnd,
        shift: r.shift,
        attendant_id: r.attendant_id,
        attendant_name: r.attendant_name,
        role: r.role,
        fuel_sales_litres: Number(r.fuel_sales_litres) || 0,
        lub_qty: Number(r.lub_qty) || 0,
        notes: r.notes || '',
      }))
      const res = await fetch('/api/excel/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: selectedWeek, rows: payload }),
      })
      if (res.ok) {
        setMessage('Week saved successfully!')
        const weeksData = await fetch('/api/excel/weekly', { method: 'PUT' }).then((r) => r.json())
        setWeeks(Array.isArray(weeksData) ? weeksData : [])
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? 'Error saving. Please try again.')
      }
    } catch {
      setError('Save failed. Check your connection and try again.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const shiftBadgeClass: Record<string, string> = {
    A: 'bg-blue-600 text-white border-transparent',
    B: 'bg-emerald-600 text-white border-transparent',
    C: 'bg-violet-600 text-white border-transparent',
  }
  const shiftGroupClass: Record<string, string> = {
    A: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-l-2 border-blue-400',
    B: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-l-2 border-emerald-400',
    C: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-l-2 border-violet-400',
  }
  const shiftIdClass: Record<string, string> = {
    A: 'text-blue-600 dark:text-blue-400',
    B: 'text-emerald-600 dark:text-emerald-400',
    C: 'text-violet-600 dark:text-violet-400',
  }

  return (
    <div>
      <Header title="Weekly Entry" />
      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Past weeks list */}
          <Card className="lg:w-64 shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Past Weeks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {weeks.map((w) => (
                <button
                  key={w.week_start}
                  onClick={() => loadWeek(w.week_start)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedWeek === w.week_start
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {w.week_start ? format(new Date(w.week_start + 'T00:00:00'), 'MMM d') : ''}
                  {' – '}
                  {w.week_end ? format(new Date(w.week_end + 'T00:00:00'), 'MMM d') : ''}
                </button>
              ))}
              {weeks.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground px-3">No weeks yet</p>
              )}
            </CardContent>
          </Card>

          {/* Main content */}
          <div className="flex-1 space-y-4">
            {/* New week selector */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Week Start Date</label>
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-44"
                    />
                  </div>
                  {customDate && (
                    <p className="text-sm text-muted-foreground pb-2">
                      Week end: <span className="font-medium">{format(addDays(parseISO(customDate), 6), 'MMM d, yyyy')}</span>
                    </p>
                  )}
                  <Button onClick={handleNewWeek} disabled={!customDate} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Load / New Week
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Entry table */}
            {selectedWeek && (
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Week of {format(new Date(selectedWeek + 'T00:00:00'), 'MMMM d, yyyy')}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {message && <span className="text-sm text-green-600 dark:text-green-400">{message}</span>}
                    <Button onClick={saveWeek} disabled={saving} size="sm" className="gap-2">
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Week'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="w-16 font-semibold text-foreground text-sm">ID</TableHead>
                            <TableHead className="min-w-[160px] font-semibold text-foreground text-sm">Name</TableHead>
                            <TableHead className="w-16 font-semibold text-foreground text-sm">Shift</TableHead>
                            <TableHead className="w-28 font-semibold text-foreground text-sm">Role</TableHead>
                            <TableHead className="w-36 font-semibold text-foreground text-sm">Fuel Sales (L)</TableHead>
                            <TableHead className="w-28 font-semibold text-foreground text-sm">Lub Qty</TableHead>
                            <TableHead className="font-semibold text-foreground text-sm">Notes</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                                No active staff found. Add staff members on the Staff page first.
                              </TableCell>
                            </TableRow>
                          )}
                          {(['A', 'B', 'C'] as const).flatMap((shift) => {
                            const shiftRows = rows.filter((r) => r.shift === shift)
                            if (shiftRows.length === 0) return []
                            return [
                              <TableRow key={`group-${shift}`} className={`hover:opacity-100 ${shiftGroupClass[shift]}`}>
                                <TableCell colSpan={8} className="py-1.5 px-4">
                                  <span className="text-xs font-bold uppercase tracking-widest">Shift {shift}</span>
                                </TableCell>
                              </TableRow>,
                              ...shiftRows.map((row) => {
                                const idx = rows.indexOf(row)
                                return (
                                  <TableRow
                                    key={row.attendant_id}
                                    className="group hover:bg-muted/50 transition-colors"
                                  >
                                    <TableCell className={`font-mono font-semibold text-sm ${shiftIdClass[row.shift]}`}>
                                      {row.attendant_id}
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-semibold text-base leading-tight">{row.attendant_name}</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={`text-sm font-bold px-2.5 py-0.5 ${shiftBadgeClass[row.shift]}`}>
                                        {row.shift}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{row.role}</TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={row.fuel_sales_litres}
                                        onChange={(e) => updateRow(idx, 'fuel_sales_litres', parseFloat(e.target.value) || 0)}
                                        className="w-full text-right font-medium"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min={0}
                                        step={0.5}
                                        value={row.lub_qty}
                                        onChange={(e) => updateRow(idx, 'lub_qty', parseFloat(e.target.value) || 0)}
                                        className="w-full text-right font-medium"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        value={row.notes}
                                        onChange={(e) => updateRow(idx, 'notes', e.target.value)}
                                        placeholder="Add a note…"
                                        className="w-full"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                                        onClick={() => deleteRow(idx)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )
                              }),
                            ]
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!selectedWeek && !loading && (
              <div className="text-center py-16 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a past week or enter a new date above to begin</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
