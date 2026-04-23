'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { NotificationPanel } from '@/components/layout/NotificationPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Pencil, Trash2, UserPlus, Plus, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { isManagerLevel, ALL_ROLES, ROLE_LABELS, ENTITY_LABELS, CONTRACT_STATUS_LABELS } from '@/lib/roles'

interface CurrentUser {
  id: number
  role: string
  display_name: string
  username: string
}

interface User {
  id: number
  display_name: string
  role: string
  is_active: boolean
  username: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  job_title: string | null
  start_date: string | null
  entity: string | null
  contract_status: string | null
  contract_end_date: string | null
}

interface KPIRecord {
  id: number
  user_id: number
  overall_score: number | null
  rating_band: string | null
  month: number
  year: number
  kpi_schedule_signed: boolean
}

interface PIPRecord {
  id: number
  user_id: number
  trigger_reason: string
  issued_date: string
  review_date: string
  improvement_targets: string
  current_progress: string | null
  status: string
  outcome: string | null
  closed_date: string | null
  user: { id: number; display_name: string; role: string }
  created_by: { id: number; display_name: string }
}

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  ACTIVE:     'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  PROBATION:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  FIXED_TERM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  EXPIRED:    'bg-destructive/10 text-destructive',
}

const SCORE_COLORS: Record<string, string> = {
  EXCEPTIONAL:    'text-green-600 dark:text-green-400',
  ON_TARGET:      'text-green-600 dark:text-green-400',
  BELOW_TARGET:   'text-amber-600 dark:text-amber-400',
  UNSATISFACTORY: 'text-destructive',
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const emptyUserForm = {
  username: '', display_name: '', role: 'HR', password: '',
  first_name: '', last_name: '', email: '', phone: '', job_title: '', start_date: '',
  entity: 'BOTH', contract_status: '', contract_end_date: '',
}

const emptyPIPForm = {
  trigger_reason: '',
  issued_date: new Date().toISOString().split('T')[0],
  review_date: '',
  improvement_targets: '',
  current_progress: '',
}

const ENTITY_GROUPS = [
  { key: 'FUEL_STATION',  label: 'Fuel Station' },
  { key: 'CONSTRUCTION',  label: 'Construction' },
  { key: 'BOTH',          label: 'Both / Shared' },
  { key: 'UNASSIGNED',    label: 'Unassigned' },
]

function contractExpiryWarning(endDate: string | null): 'expired' | 'soon' | null {
  if (!endDate) return null
  const end = new Date(endDate)
  const now = new Date()
  const diff = end.getTime() - now.getTime()
  if (diff < 0) return 'expired'
  if (diff < 30 * 24 * 60 * 60 * 1000) return 'soon'
  return null
}

export default function TeamPage() {
  const [currentUser, setCurrentUser]   = useState<CurrentUser | null>(null)
  const [users, setUsers]               = useState<User[]>([])
  const [latestKPIs, setLatestKPIs]     = useState<KPIRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')

  // Edit/add user dialog
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm]       = useState(emptyUserForm)
  const [userFormError, setUserFormError] = useState('')
  const [savingUser, setSavingUser]       = useState(false)

  // Employee detail dialog
  const [detailUser, setDetailUser]         = useState<User | null>(null)
  const [detailKPIs, setDetailKPIs]         = useState<KPIRecord[]>([])
  const [detailPIPs, setDetailPIPs]         = useState<PIPRecord[]>([])
  const [detailLoading, setDetailLoading]   = useState(false)
  const [detailTab, setDetailTab]           = useState('overview')

  // PIP form inside detail dialog
  const [pipForm, setPipForm]         = useState(emptyPIPForm)
  const [pipFormOpen, setPipFormOpen] = useState(false)
  const [pipFormError, setPipFormError] = useState('')
  const [savingPIP, setSavingPIP]       = useState(false)

  // PIP update (close/progress)
  const [updatingPipId, setUpdatingPipId] = useState<number | null>(null)
  const [pipProgress, setPipProgress]     = useState('')
  const [pipCloseOutcome, setPipCloseOutcome] = useState('')
  const [pipCloseMode, setPipCloseMode]   = useState<number | null>(null)

  useEffect(() => {
    async function init() {
      const now = new Date()
      const [meRes, usersRes, kpiRes] = await Promise.all([
        fetch('/api/auth'),
        fetch('/api/users'),
        fetch(`/api/kpi?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
      ])
      if (meRes.ok)    setCurrentUser((await meRes.json()).data)
      if (usersRes.ok) setUsers((await usersRes.json()).data ?? [])
      if (kpiRes.ok)   setLatestKPIs((await kpiRes.json()).data ?? [])
    }
    init()
  }, [])

  const refreshUsers = useCallback(async () => {
    const res = await fetch('/api/users')
    if (res.ok) setUsers((await res.json()).data ?? [])
  }, [])

  const openDetail = useCallback(async (user: User) => {
    setDetailUser(user)
    setDetailTab('overview')
    setPipFormOpen(false)
    setPipForm(emptyPIPForm)
    setDetailLoading(true)
    const now = new Date()
    const [kpiRes, pipRes] = await Promise.all([
      fetch(`/api/kpi?year=${now.getFullYear()}`),
      fetch(`/api/pip?user_id=${user.id}`),
    ])
    const allKPIs: KPIRecord[] = kpiRes.ok ? ((await kpiRes.json()).data ?? []) : []
    setDetailKPIs(allKPIs.filter((k) => k.user_id === user.id))
    setDetailPIPs(pipRes.ok ? ((await pipRes.json()).data ?? []) : [])
    setDetailLoading(false)
  }, [])

  function openAdd() {
    setUserForm(emptyUserForm)
    setUserFormError('')
    setEditingUser(null)
    setDialogMode('add')
  }

  function openEdit(user: User) {
    setEditingUser(user)
    setUserForm({
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      password: '',
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      job_title: user.job_title ?? '',
      start_date: user.start_date ? user.start_date.split('T')[0] : '',
      entity: user.entity ?? 'BOTH',
      contract_status: user.contract_status ?? '',
      contract_end_date: user.contract_end_date ? user.contract_end_date.split('T')[0] : '',
    })
    setUserFormError('')
    setDialogMode('edit')
  }

  function userField(key: keyof typeof emptyUserForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setUserForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function saveUser() {
    setSavingUser(true)
    setUserFormError('')
    try {
      let res: Response
      if (dialogMode === 'add') {
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...userForm,
            entity: userForm.entity || undefined,
            contract_status: userForm.contract_status || undefined,
            contract_end_date: userForm.contract_end_date || undefined,
          }),
        })
      } else {
        const body: Record<string, unknown> = {
          display_name: userForm.display_name,
          role: userForm.role,
          first_name: userForm.first_name || undefined,
          last_name: userForm.last_name || undefined,
          email: userForm.email || undefined,
          phone: userForm.phone || undefined,
          job_title: userForm.job_title || undefined,
          start_date: userForm.start_date || undefined,
          entity: userForm.entity || undefined,
          contract_status: userForm.contract_status || undefined,
          contract_end_date: userForm.contract_end_date || undefined,
        }
        if (userForm.password) body.password = userForm.password
        res = await fetch(`/api/users/${editingUser!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setUserFormError(d.error ?? 'Failed to save')
        return
      }
      await refreshUsers()
      setDialogMode(null)
    } catch {
      setUserFormError('Something went wrong')
    } finally {
      setSavingUser(false)
    }
  }

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    await refreshUsers()
    if (detailUser?.id === user.id) {
      setDetailUser((u) => u ? { ...u, is_active: !u.is_active } : u)
    }
  }

  async function savePIP() {
    if (!detailUser) return
    setSavingPIP(true)
    setPipFormError('')
    try {
      const res = await fetch('/api/pip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pipForm, user_id: detailUser.id }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setPipFormError(d.error ?? 'Failed to create PIP')
        return
      }
      const newPip = (await res.json()).data
      setDetailPIPs((prev) => [newPip, ...prev])
      setPipFormOpen(false)
      setPipForm(emptyPIPForm)
    } catch {
      setPipFormError('Something went wrong')
    } finally {
      setSavingPIP(false)
    }
  }

  async function updatePIPProgress(pipId: number) {
    setUpdatingPipId(pipId)
    const res = await fetch(`/api/pip/${pipId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_progress: pipProgress }),
    })
    if (res.ok) {
      const updated = (await res.json()).data
      setDetailPIPs((prev) => prev.map((p) => p.id === pipId ? updated : p))
    }
    setUpdatingPipId(null)
    setPipProgress('')
  }

  async function closePIP(pipId: number) {
    setUpdatingPipId(pipId)
    const res = await fetch(`/api/pip/${pipId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'CLOSED',
        outcome: pipCloseOutcome || 'SUCCESS',
        closed_date: new Date().toISOString().split('T')[0],
      }),
    })
    if (res.ok) {
      const updated = (await res.json()).data
      setDetailPIPs((prev) => prev.map((p) => p.id === pipId ? updated : p))
    }
    setUpdatingPipId(null)
    setPipCloseMode(null)
    setPipCloseOutcome('')
  }

  const isManager = currentUser ? isManagerLevel(currentUser.role) : false

  if (currentUser && !isManager) {
    return (
      <div>
        <Header title="Team"><NotificationPanel /></Header>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Access restricted to managers.</p>
        </div>
      </div>
    )
  }

  const kpiMap = new Map(latestKPIs.map((k) => [k.user_id, k]))

  const filteredUsers = users.filter((u) => {
    if (statusFilter === 'active')   return u.is_active
    if (statusFilter === 'inactive') return !u.is_active
    return true
  })

  const grouped = ENTITY_GROUPS.map((g) => ({
    ...g,
    members: filteredUsers.filter((u) => {
      const e = u.entity ?? 'UNASSIGNED'
      return g.key === 'UNASSIGNED' ? !u.entity || u.entity === '' : e === g.key
    }),
  })).filter((g) => g.members.length > 0)

  const activeCount   = users.filter((u) => u.is_active).length
  const inactiveCount = users.filter((u) => !u.is_active).length

  return (
    <div>
      <Header title="Team">
        <NotificationPanel />
      </Header>
      <div className="p-6 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Status filter tabs */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(['active', 'all', 'inactive'] as const).map((s) => {
              const label = s === 'active' ? `Active (${activeCount})` : s === 'inactive' ? `Inactive (${inactiveCount})` : `All (${users.length})`
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 font-medium transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {isManager && (
            <Button size="sm" onClick={openAdd}>
              <UserPlus className="h-4 w-4 mr-1" /> Add Employee
            </Button>
          )}
        </div>

        {/* Grouped tables */}
        {grouped.map((group) => (
          <div key={group.key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {group.label}
            </p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Role</th>
                    <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">Contract</th>
                    <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">End Date</th>
                    <th className="text-left px-4 py-2 font-medium">KPI Score</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((u) => {
                    const kpi      = kpiMap.get(u.id)
                    const expiry   = contractExpiryWarning(u.contract_end_date)
                    return (
                      <tr
                        key={u.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => openDetail(u)}
                      >
                        <td className="px-4 py-2">
                          <p className="font-medium">{u.display_name}</p>
                          {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                          {ROLE_LABELS[u.role] ?? u.role}
                        </td>
                        <td className="px-4 py-2 hidden lg:table-cell">
                          {u.contract_status ? (
                            <Badge className={`text-[10px] border-0 ${CONTRACT_STATUS_COLORS[u.contract_status] ?? ''}`}>
                              {CONTRACT_STATUS_LABELS[u.contract_status] ?? u.contract_status}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2 hidden lg:table-cell text-xs">
                          {u.contract_end_date ? (
                            <span className={
                              expiry === 'expired' ? 'text-destructive font-medium' :
                              expiry === 'soon'    ? 'text-amber-600 dark:text-amber-400 font-medium' :
                              'text-muted-foreground'
                            }>
                              {new Date(u.contract_end_date).toLocaleDateString()}
                              {expiry === 'expired' && ' ⚠'}
                              {expiry === 'soon'    && ' ⚡'}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {kpi?.overall_score != null ? (
                            <span className={`font-semibold ${SCORE_COLORS[kpi.rating_band ?? ''] ?? ''}`}>
                              {Math.round(kpi.overall_score)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={u.is_active ? 'default' : 'secondary'} className="text-xs">
                            {u.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {isManager && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground"
                                  onClick={() => toggleActive(u)}
                                  title={u.is_active ? 'Deactivate' : 'Activate'}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add / Edit user dialog ── */}
      <Dialog open={!!dialogMode} onOpenChange={(open) => { if (!open) setDialogMode(null) }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? 'Add Employee' : 'Edit Employee'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={userForm.display_name} onChange={userField('display_name')} placeholder="Full name" />
            </div>
            {dialogMode === 'add' && (
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={userForm.username} onChange={userField('username')} placeholder="Login username" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={userForm.role} onValueChange={(v) => v && setUserForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entity</Label>
                <Select value={userForm.entity} onValueChange={(v) => v && setUserForm((f) => ({ ...f, entity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ENTITY_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{dialogMode === 'add' ? 'Password' : 'New Password (leave blank to keep)'}</Label>
              <Input type="password" value={userForm.password} onChange={userField('password')} />
            </div>
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Contract</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Contract Status</Label>
                  <Select value={userForm.contract_status || 'none'} onValueChange={(v) => v && setUserForm((f) => ({ ...f, contract_status: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="PROBATION">Probation</SelectItem>
                      <SelectItem value="FIXED_TERM">Fixed-term</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={userForm.contract_end_date} onChange={userField('contract_end_date')} />
                </div>
              </div>
            </div>
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Profile</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={userForm.first_name} onChange={userField('first_name')} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={userForm.last_name} onChange={userField('last_name')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={userForm.email} onChange={userField('email')} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" value={userForm.phone} onChange={userField('phone')} />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input value={userForm.job_title} onChange={userField('job_title')} />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={userForm.start_date} onChange={userField('start_date')} />
              </div>
            </div>
            {userFormError && <p className="text-sm text-destructive">{userFormError}</p>}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={savingUser}>Cancel</Button>
            <Button onClick={saveUser} disabled={savingUser}>{savingUser ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Employee detail dialog ── */}
      <Dialog open={!!detailUser} onOpenChange={(open) => { if (!open) setDetailUser(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailUser && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div>
                    <DialogTitle className="text-lg">{detailUser.display_name}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {ROLE_LABELS[detailUser.role] ?? detailUser.role}
                      {detailUser.entity && ` · ${ENTITY_LABELS[detailUser.entity] ?? detailUser.entity}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={detailUser.is_active ? 'default' : 'secondary'} className="text-xs">
                      {detailUser.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {isManager && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDetailUser(null); openEdit(detailUser) }}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                  <TabsTrigger value="kpi" className="flex-1">KPI History</TabsTrigger>
                  <TabsTrigger value="pip" className="flex-1">
                    PIPs
                    {detailPIPs.filter((p) => p.status === 'ACTIVE').length > 0 && (
                      <span className="ml-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                        {detailPIPs.filter((p) => p.status === 'ACTIVE').length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Overview tab */}
                <TabsContent value="overview" className="mt-4 space-y-4">
                  {detailLoading ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        {detailUser.job_title && (
                          <div><p className="text-xs text-muted-foreground">Job Title</p><p className="font-medium">{detailUser.job_title}</p></div>
                        )}
                        {detailUser.email && (
                          <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{detailUser.email}</p></div>
                        )}
                        {detailUser.phone && (
                          <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{detailUser.phone}</p></div>
                        )}
                        {detailUser.start_date && (
                          <div><p className="text-xs text-muted-foreground">Start Date</p><p className="font-medium">{new Date(detailUser.start_date).toLocaleDateString()}</p></div>
                        )}
                      </div>

                      {(detailUser.contract_status || detailUser.contract_end_date) && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Contract</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              {detailUser.contract_status && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Status</p>
                                  <Badge className={`text-[10px] border-0 mt-0.5 ${CONTRACT_STATUS_COLORS[detailUser.contract_status] ?? ''}`}>
                                    {CONTRACT_STATUS_LABELS[detailUser.contract_status] ?? detailUser.contract_status}
                                  </Badge>
                                </div>
                              )}
                              {detailUser.contract_end_date && (
                                <div>
                                  <p className="text-xs text-muted-foreground">End Date</p>
                                  {(() => {
                                    const exp = contractExpiryWarning(detailUser.contract_end_date)
                                    return (
                                      <p className={`font-medium ${exp === 'expired' ? 'text-destructive' : exp === 'soon' ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                                        {new Date(detailUser.contract_end_date).toLocaleDateString()}
                                        {exp === 'expired' && <span className="ml-1 text-xs">(Expired)</span>}
                                        {exp === 'soon'    && <span className="ml-1 text-xs">(Expires soon)</span>}
                                      </p>
                                    )
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {isManager && (
                        <>
                          <Separator />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8"
                              onClick={() => { setDetailTab('pip'); setPipFormOpen(true) }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Issue PIP
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8"
                              onClick={() => toggleActive(detailUser)}
                            >
                              {detailUser.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* KPI History tab */}
                <TabsContent value="kpi" className="mt-4">
                  {detailLoading ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
                  ) : detailKPIs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No KPI records found.</p>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-3 py-2 font-medium">Period</th>
                            <th className="text-left px-3 py-2 font-medium">Score</th>
                            <th className="text-left px-3 py-2 font-medium">Rating</th>
                            <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Signed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailKPIs.map((k) => {
                            const band = k.rating_band
                            return (
                              <tr key={k.id} className="border-b last:border-0">
                                <td className="px-3 py-2 text-muted-foreground">{MONTHS[k.month - 1]} {k.year}</td>
                                <td className={`px-3 py-2 font-semibold ${SCORE_COLORS[band ?? ''] ?? ''}`}>
                                  {k.overall_score != null ? `${Math.round(k.overall_score)}%` : '—'}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  {band ? (
                                    <Badge variant="outline" className={`text-[10px] border-0 ${
                                      band === 'EXCEPTIONAL'    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                                      band === 'ON_TARGET'      ? 'bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-400' :
                                      band === 'BELOW_TARGET'   ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' :
                                      'bg-destructive/10 text-destructive'
                                    }`}>
                                      {band.replace(/_/g, ' ')}
                                    </Badge>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2 hidden sm:table-cell">
                                  {k.kpi_schedule_signed
                                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    : <span className="text-muted-foreground text-xs">No</span>
                                  }
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* PIPs tab */}
                <TabsContent value="pip" className="mt-4 space-y-4">
                  {detailLoading ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
                  ) : (
                    <>
                      {isManager && !pipFormOpen && (
                        <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setPipFormOpen(true)}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Issue New PIP
                        </Button>
                      )}

                      {/* PIP creation form */}
                      {pipFormOpen && (
                        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                          <p className="text-sm font-medium">New Performance Improvement Plan</p>
                          <div className="space-y-2">
                            <Label className="text-xs">Trigger Reason</Label>
                            <Input
                              className="h-8 text-xs"
                              value={pipForm.trigger_reason}
                              onChange={(e) => setPipForm((f) => ({ ...f, trigger_reason: e.target.value }))}
                              placeholder="Reason for issuing PIP..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Issued Date</Label>
                              <Input
                                className="h-8 text-xs"
                                type="date"
                                value={pipForm.issued_date}
                                onChange={(e) => setPipForm((f) => ({ ...f, issued_date: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Review Date</Label>
                              <Input
                                className="h-8 text-xs"
                                type="date"
                                value={pipForm.review_date}
                                onChange={(e) => setPipForm((f) => ({ ...f, review_date: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Improvement Targets</Label>
                            <Input
                              className="h-8 text-xs"
                              value={pipForm.improvement_targets}
                              onChange={(e) => setPipForm((f) => ({ ...f, improvement_targets: e.target.value }))}
                              placeholder="List specific improvement targets..."
                            />
                          </div>
                          {pipFormError && <p className="text-xs text-destructive">{pipFormError}</p>}
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={savePIP} disabled={savingPIP}>
                              {savingPIP ? 'Saving...' : 'Issue PIP'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setPipFormOpen(false); setPipFormError('') }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* PIP list */}
                      {detailPIPs.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No PIPs on record.</p>
                      ) : (
                        <div className="space-y-3">
                          {detailPIPs.map((pip) => (
                            <div key={pip.id} className={`rounded-lg border p-4 space-y-2 ${pip.status === 'ACTIVE' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-900/10' : 'opacity-70'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {pip.status === 'ACTIVE'
                                    ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    : <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                  }
                                  <p className="text-sm font-medium">{pip.trigger_reason}</p>
                                </div>
                                <Badge variant="outline" className={`text-[10px] shrink-0 ${pip.status === 'ACTIVE' ? 'border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400' : ''}`}>
                                  {pip.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{pip.improvement_targets}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Issued: {new Date(pip.issued_date).toLocaleDateString()}
                                </span>
                                <span>Review: {new Date(pip.review_date).toLocaleDateString()}</span>
                              </div>
                              {pip.current_progress && (
                                <p className="text-xs text-muted-foreground border-t pt-2">
                                  <span className="font-medium">Progress: </span>{pip.current_progress}
                                </p>
                              )}
                              {pip.outcome && (
                                <p className="text-xs border-t pt-2">
                                  <span className="font-medium">Outcome: </span>{pip.outcome}
                                </p>
                              )}

                              {/* PIP actions — only for active PIPs */}
                              {isManager && pip.status === 'ACTIVE' && (
                                <div className="border-t pt-2 space-y-2">
                                  {pipCloseMode === pip.id ? (
                                    <div className="flex items-center gap-2">
                                      <Select value={pipCloseOutcome || 'SUCCESS'} onValueChange={(v) => v && setPipCloseOutcome(v)}>
                                        <SelectTrigger className="h-7 text-xs flex-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="SUCCESS">Success</SelectItem>
                                          <SelectItem value="EXTENDED">Extended</SelectItem>
                                          <SelectItem value="TERMINATED">Terminated</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button size="sm" className="h-7 text-xs" onClick={() => closePIP(pip.id)} disabled={updatingPipId === pip.id}>
                                        {updatingPipId === pip.id ? '...' : 'Close PIP'}
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPipCloseMode(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <Input
                                        className="h-7 text-xs flex-1"
                                        placeholder="Update progress..."
                                        value={updatingPipId === pip.id ? pipProgress : pipProgress}
                                        onChange={(e) => setPipProgress(e.target.value)}
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => updatePIPProgress(pip.id)}
                                        disabled={updatingPipId === pip.id || !pipProgress}
                                      >
                                        Update
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => setPipCloseMode(pip.id)}
                                      >
                                        Close
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
