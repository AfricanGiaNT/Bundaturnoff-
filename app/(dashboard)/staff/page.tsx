'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { IndividualSummary, StaffMember } from '@/lib/types'
import { format } from 'date-fns'

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

type SortKey = keyof IndividualSummary
type SortDir = 'asc' | 'desc'

const EMPTY_STAFF: StaffMember = {
  attendant_id: '',
  attendant_name: '',
  shift: 'A',
  role: 'Attendant',
  start_date: new Date().toISOString().split('T')[0],
  status: 'Active',
}

export default function StaffPage() {
  const [individual, setIndividual] = useState<IndividualSummary[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('total_fuel')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMember, setEditMember] = useState<StaffMember | null>(null)
  const [form, setForm] = useState<StaffMember>(EMPTY_STAFF)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadData() {
    const [ind, staff] = await Promise.all([
      fetch('/api/excel/individual').then((r) => r.json()),
      fetch('/api/excel/staff').then((r) => r.json()),
    ])
    setIndividual(ind)
    setStaffList(staff)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...individual].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey]
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
  }

  function openAdd() {
    setForm(EMPTY_STAFF); setEditMember(null); setError(''); setDialogOpen(true)
  }
  function openEdit(s: StaffMember) {
    setForm({ ...s }); setEditMember(s); setError(''); setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.attendant_id || !form.attendant_name) { setError('ID and Name are required.'); return }
    setSaving(true); setError('')
    const method = editMember ? 'PUT' : 'POST'
    const res = await fetch('/api/excel/staff', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error || 'Failed to save.'); return }
    setDialogOpen(false)
    setLoading(true)
    loadData()
  }

  async function toggleStatus(s: StaffMember) {
    const updated = { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' }
    await fetch('/api/excel/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setLoading(true)
    loadData()
  }

  const shiftBadge = (shift: string) =>
    shift === 'A' ? 'default' : shift === 'B' ? 'secondary' : 'outline'

  return (
    <div>
      <Header title="Staff" />
      <div className="p-6">
        <Tabs defaultValue="performance">
          <TabsList className="mb-4">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="registry">Registry</TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <Card>
              <CardHeader><CardTitle className="text-base">Individual Performance</CardTitle></CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-64 w-full" /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {([
                            ['attendant_name', 'Name'],
                            ['shift', 'Shift'],
                            ['role', 'Role'],
                            ['weeks_worked', 'Weeks'],
                            ['total_fuel', 'Total Fuel (L)'],
                            ['avg_weekly_fuel', 'Avg / Week (L)'],
                            ['best_week_fuel', 'Best Week (L)'],
                            ['worst_week_fuel', 'Worst Week (L)'],
                          ] as [SortKey, string][]).map(([key, label]) => (
                            <TableHead key={key}>
                              <button
                                className="flex items-center text-xs font-medium hover:text-foreground"
                                onClick={() => toggleSort(key)}
                              >
                                {label}<SortIcon col={key} />
                              </button>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map((row) => (
                          <TableRow key={row.attendant_id}>
                            <TableCell className="font-medium">{row.attendant_name}</TableCell>
                            <TableCell>
                              <Badge variant={shiftBadge(row.shift) as 'default' | 'secondary' | 'outline'}>{row.shift}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{row.role}</TableCell>
                            <TableCell className="text-right">{row.weeks_worked}</TableCell>
                            <TableCell className="text-right">{fmt(row.total_fuel)}</TableCell>
                            <TableCell className="text-right">{fmt(row.avg_weekly_fuel)}</TableCell>
                            <TableCell className="text-right">{fmt(row.best_week_fuel)}</TableCell>
                            <TableCell className="text-right">{fmt(row.worst_week_fuel)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Registry Tab */}
          <TabsContent value="registry">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Staff Registry</CardTitle>
                <Button size="sm" onClick={openAdd} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Staff
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-64 w-full" /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Shift</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffList.map((s) => (
                          <TableRow key={s.attendant_id}>
                            <TableCell className="text-muted-foreground text-xs">{s.attendant_id}</TableCell>
                            <TableCell className="font-medium">{s.attendant_name}</TableCell>
                            <TableCell>
                              <Badge variant={shiftBadge(s.shift) as 'default' | 'secondary' | 'outline'}>{s.shift}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{s.role}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {s.start_date ? format(new Date(s.start_date + 'T00:00:00'), 'MMM d, yyyy') : ''}
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.status === 'Active' ? 'default' : 'secondary'}
                                className={s.status === 'Active' ? 'bg-green-600 text-white' : ''}>
                                {s.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => toggleStatus(s)}
                                >
                                  {s.status === 'Active' ? 'Deactivate' : 'Activate'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editMember ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Attendant ID</Label>
              <Input value={form.attendant_id} onChange={(e) => setForm({ ...form, attendant_id: e.target.value })}
                placeholder="e.g. D01" disabled={!!editMember} />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={form.attendant_name} onChange={(e) => setForm({ ...form, attendant_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v ?? 'A' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Shift A</SelectItem>
                  <SelectItem value="B">Shift B</SelectItem>
                  <SelectItem value="C">Shift C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v ?? 'Attendant' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Leader">Leader</SelectItem>
                  <SelectItem value="Attendant">Attendant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v ?? 'Active' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
