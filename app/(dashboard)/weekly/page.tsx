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

  // Load staff and weeks list
  useEffect(() => {
    Promise.all([
      fetch('/api/excel/staff').then((r) => r.json()),
      fetch('/api/excel/weekly', { method: 'PUT' }).then((r) => r.json()),
    ]).then(([staffData, weeksData]) => {
      setStaff(staffData)
      setWeeks(weeksData)
      setLoading(false)
    })
  }, [])

  const loadWeek = useCallback(async (weekStart: string) => {
    setLoading(true)
    setSelectedWeek(weekStart)
    const existing: WeeklyRow[] = await fetch(`/api/excel/weekly?week_start=${weekStart}`).then((r) => r.json())
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
    setLoading(false)
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
    setSaving(false)
    if (res.ok) {
      setMessage('Week saved successfully!')
      // Refresh weeks list
      const weeksData = await fetch('/api/excel/weekly', { method: 'PUT' }).then((r) => r.json())
      setWeeks(weeksData)
    } else {
      setMessage('Error saving. Please try again.')
    }
    setTimeout(() => setMessage(''), 4000)
  }

  const shiftColors: Record<string, string> = { A: 'default', B: 'secondary', C: 'outline' }

  return (
    <div>
      <Header title="Weekly Entry" />
      <div className="p-6 space-y-6">
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
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Shift</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Fuel Sales (L)</TableHead>
                            <TableHead className="text-right">Lub Qty</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row, idx) => (
                            <TableRow key={row.attendant_id}>
                              <TableCell className="text-muted-foreground text-xs">{row.attendant_id}</TableCell>
                              <TableCell className="font-medium text-sm">{row.attendant_name}</TableCell>
                              <TableCell>
                                <Badge variant={shiftColors[row.shift] as 'default' | 'secondary' | 'outline' | 'destructive'}>
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
                                  className="w-28 text-right"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={row.lub_qty}
                                  onChange={(e) => updateRow(idx, 'lub_qty', parseFloat(e.target.value) || 0)}
                                  className="w-20 text-right"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.notes}
                                  onChange={(e) => updateRow(idx, 'notes', e.target.value)}
                                  placeholder="Notes"
                                  className="w-28"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteRow(idx)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
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
