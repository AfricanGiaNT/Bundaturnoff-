'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload, Search, CreditCard, Trophy, ChevronDown, ChevronUp,
  RefreshCw, Database, Calendar, BarChart2,
} from 'lucide-react'
import { POSStats, POSTransaction, POSCustomerSummary } from '@/lib/types'
import { format } from 'date-fns'

const PREVIEW_COUNT = 4
const BROWSE_LIMIT = 30

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtAmount(n: number) {
  return 'MK ' + n.toLocaleString('en-MW')
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'dd MMM yyyy') } catch { return iso }
}

function fmtTime(iso: string) {
  try { return format(new Date(iso), 'HH:mm') } catch { return '' }
}

function fmtDateRange(from: string | null, to: string | null) {
  if (!from || !to) return '—'
  return `${fmtDate(from)} – ${fmtDate(to)}`
}

const RANK_COLORS: Record<number, string> = {
  1: 'bg-yellow-400/20 text-yellow-700 border-yellow-400',
  2: 'bg-slate-300/20 text-slate-600 border-slate-400',
  3: 'bg-orange-300/20 text-orange-700 border-orange-400',
}

// ─── shared transaction table ─────────────────────────────────────────────────

function TxTable({ rows }: { rows: POSTransaction[] }) {
  return (
    <Table className="text-sm">
      <colgroup>
        <col style={{ width: '110px' }} />
        <col style={{ width: '130px' }} />
        <col style={{ width: '160px' }} />
        <col style={{ width: '90px' }} />
        <col style={{ width: '72px' }} />
        <col style={{ width: '90px' }} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className="py-2">Date</TableHead>
          <TableHead className="py-2 text-right">Amount</TableHead>
          <TableHead className="py-2">Card</TableHead>
          <TableHead className="py-2">Month</TableHead>
          <TableHead className="py-2">Time</TableHead>
          <TableHead className="py-2">Terminal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((tx, i) => (
          <TableRow key={tx.switch_key} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
            <TableCell className="py-2 font-medium">{fmtDate(tx.datetime_local)}</TableCell>
            <TableCell className="py-2 text-right font-mono">{fmtAmount(tx.amount)}</TableCell>
            <TableCell className="py-2 font-mono text-xs">{tx.card_number}</TableCell>
            <TableCell className="py-2">
              <Badge variant="secondary" className="text-xs">{tx.sheet_month}</Badge>
            </TableCell>
            <TableCell className="py-2 font-mono text-xs">{fmtTime(tx.datetime_local)}</TableCell>
            <TableCell className="py-2 text-xs text-muted-foreground">{tx.terminal_id}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function POSPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // stats
  const [stats, setStats] = useState<POSStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // upload
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number; months: string[] } | null>(null)
  const [uploadError, setUploadError] = useState('')

  // search
  const [last4, setLast4] = useState('')
  const [searchMonth, setSearchMonth] = useState('all')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<POSTransaction[]>([])
  const [searchMeta, setSearchMeta] = useState<{ total_count: number; total_amount: number } | null>(null)
  const [searchError, setSearchError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // browse
  const [browseMonth, setBrowseMonth] = useState('')
  const [browseRows, setBrowseRows] = useState<POSTransaction[]>([])
  const [browseTotal, setBrowseTotal] = useState(0)
  const [browseTotalAmount, setBrowseTotalAmount] = useState(0)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseOffset, setBrowseOffset] = useState(0)

  // customers
  const [customersMonth, setCustomersMonth] = useState('all')
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customers, setCustomers] = useState<POSCustomerSummary[]>([])
  const [customersLoaded, setCustomersLoaded] = useState(false)

  const months = stats?.months ?? []

  // ── load stats ──────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/pos/stats')
      if (res.ok) setStats(await res.json())
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  // ── upload ──────────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    setUploadResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/pos/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error ?? 'Upload failed')
      } else {
        setUploadResult(data)
        loadStats()
      }
    } catch {
      setUploadError('Network error — upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── search ──────────────────────────────────────────────────────────────────

  async function handleSearch() {
    if (!/^\d{4}$/.test(last4)) { setSearchError('Enter exactly 4 digits'); return }
    setSearching(true)
    setSearchError('')
    setShowAll(false)
    setHasSearched(true)
    try {
      const params = new URLSearchParams({ last4 })
      if (searchMonth !== 'all') params.set('month', searchMonth)
      const res = await fetch(`/api/pos/search?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setSearchError(data.error ?? 'Search failed')
        setSearchResults([])
        setSearchMeta(null)
      } else {
        setSearchResults(data.transactions)
        setSearchMeta({ total_count: data.total_count, total_amount: data.total_amount })
      }
    } catch {
      setSearchError('Network error — search failed')
    } finally {
      setSearching(false)
    }
  }

  // ── browse ──────────────────────────────────────────────────────────────────

  async function loadBrowse(month: string, offset: number, append: boolean) {
    setBrowseLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(BROWSE_LIMIT), offset: String(offset) })
      if (month) params.set('month', month)
      const res = await fetch(`/api/pos/browse?${params}`)
      const data = await res.json()
      if (res.ok) {
        setBrowseRows((prev) => append ? [...prev, ...data.transactions] : data.transactions)
        setBrowseTotal(data.total)
        setBrowseTotalAmount(data.total_amount)
        setBrowseOffset(offset + data.transactions.length)
      }
    } finally {
      setBrowseLoading(false)
    }
  }

  function handleBrowseMonthChange(m: string) {
    setBrowseMonth(m)
    setBrowseRows([])
    setBrowseOffset(0)
    loadBrowse(m === 'all' ? '' : m, 0, false)
  }

  // ── customers ───────────────────────────────────────────────────────────────

  const loadCustomers = useCallback(async (month: string) => {
    setLoadingCustomers(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (month !== 'all') params.set('month', month)
      const res = await fetch(`/api/pos/customers?${params}`)
      if (res.ok) {
        setCustomers(await res.json())
        setCustomersLoaded(true)
      }
    } finally {
      setLoadingCustomers(false)
    }
  }, [])

  function handleCustomersMonthChange(m: string) {
    setCustomersMonth(m)
    loadCustomers(m)
  }

  // ─── render ─────────────────────────────────────────────────────────────────

  const visibleResults = showAll ? searchResults : searchResults.slice(0, PREVIEW_COUNT)
  const hasMore = searchResults.length > PREVIEW_COUNT

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header title="POS Transactions" />

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(
          [
            {
              icon: <Database className="h-4 w-4 text-muted-foreground" />,
              label: 'Total Transactions',
              value: statsLoading ? null : (stats?.total_count ?? 0).toLocaleString(),
            },
            {
              icon: <BarChart2 className="h-4 w-4 text-muted-foreground" />,
              label: 'Total Volume',
              value: statsLoading ? null : fmtAmount(stats?.total_amount ?? 0),
            },
            {
              icon: <CreditCard className="h-4 w-4 text-muted-foreground" />,
              label: 'Unique Cards',
              value: statsLoading ? null : (stats?.unique_cards ?? 0).toLocaleString(),
            },
            {
              icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
              label: 'Date Range',
              value: statsLoading ? null : fmtDateRange(stats?.date_from ?? null, stats?.date_to ?? null),
            },
          ] as const
        ).map(({ icon, label, value }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            {value === null ? (
              <Skeleton className="h-6 w-3/4 mt-1" />
            ) : (
              <div className="font-semibold text-sm truncate">{value}</div>
            )}
          </Card>
        ))}
      </div>

      {/* ── Import section ── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5 mr-2" />
              {uploading ? 'Importing…' : 'Import Monthly File'}
            </Button>

            {!uploading && !uploadResult && stats && stats.total_count > 0 && (
              <span className="text-xs text-muted-foreground">
                Database holds <span className="font-medium text-foreground">{stats.total_count.toLocaleString()}</span> transactions
                across {months.length} month{months.length !== 1 ? 's' : ''}{months.length > 0 && ` (${months[0]} – ${months[months.length - 1]})`}
              </span>
            )}

            {stats?.total_count === 0 && !uploading && (
              <span className="text-xs text-muted-foreground">No data yet — upload your first monthly POS file to get started.</span>
            )}

            {uploading && <span className="text-xs text-muted-foreground">Parsing and saving to database…</span>}

            {uploadResult && (
              <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                ✓ {uploadResult.imported.toLocaleString()} new transactions added
                {uploadResult.skipped > 0 && ` · ${uploadResult.skipped} duplicates in file skipped`}
                {uploadResult.months.length > 0 && ` · ${uploadResult.months.join(', ')}`}
              </span>
            )}

            {uploadError && (
              <span className="text-xs text-destructive">{uploadError}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Main tabs ── */}
      <Tabs defaultValue="search">
        <TabsList className="mb-2">
          <TabsTrigger value="search">
            <Search className="h-3.5 w-3.5 mr-1.5" />
            Search
          </TabsTrigger>
          <TabsTrigger value="browse">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Browse
          </TabsTrigger>
          <TabsTrigger value="customers" onClick={() => { if (!customersLoaded) loadCustomers('all') }}>
            <Trophy className="h-3.5 w-3.5 mr-1.5" />
            Top Customers
          </TabsTrigger>
        </TabsList>

        {/* ── Search tab ── */}
        <TabsContent value="search">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reconcile by Message Type</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter the last 4 digits of a card number. Searches all historical data — optionally filter to a specific month.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Last 4 digits (e.g. 4335)"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => { setLast4(e.target.value.replace(/\D/g, '')); setSearchError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-44 font-mono"
                />
                <Select value={searchMonth} onValueChange={(v) => setSearchMonth(v ?? 'all')}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch} disabled={searching || last4.length !== 4}>
                  {searching ? 'Searching…' : 'Search'}
                </Button>
                {hasSearched && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setLast4(''); setSearchResults([]); setSearchMeta(null); setHasSearched(false); setShowAll(false)
                  }}>
                    Clear
                  </Button>
                )}
              </div>

              {searchError && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {searchError}
                </div>
              )}

              {searching && (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              )}

              {!searching && hasSearched && searchMeta && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-muted/40 px-4 py-3">
                      <div className="text-xs text-muted-foreground mb-0.5">Card</div>
                      <div className="font-mono font-semibold">••••{last4}</div>
                    </div>
                    <div className="rounded-lg border bg-muted/40 px-4 py-3">
                      <div className="text-xs text-muted-foreground mb-0.5">Transactions</div>
                      <div className="font-semibold">{searchMeta.total_count}</div>
                    </div>
                    <div className="rounded-lg border bg-muted/40 px-4 py-3">
                      <div className="text-xs text-muted-foreground mb-0.5">Total Spent</div>
                      <div className="font-semibold">{fmtAmount(searchMeta.total_amount)}</div>
                    </div>
                  </div>

                  {searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No transactions found for card ending in {last4}
                      {searchMonth !== 'all' ? ` in ${searchMonth}` : ''}.
                    </p>
                  ) : (
                    <>
                      <TxTable rows={visibleResults} />
                      {hasMore && (
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground"
                          onClick={() => setShowAll((v) => !v)}>
                          {showAll
                            ? <><ChevronUp className="h-4 w-4 mr-1" />Show less</>
                            : <><ChevronDown className="h-4 w-4 mr-1" />View all {searchMeta.total_count} transactions</>}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Browse tab ── */}
        <TabsContent value="browse">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Browse Transactions</CardTitle>
              <p className="text-sm text-muted-foreground">
                View all transactions for a specific month, or browse the full history.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={browseMonth || 'all'} onValueChange={(v) => handleBrowseMonthChange(v ?? 'all')}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                        {stats?.month_counts[m] && (
                          <span className="ml-2 text-muted-foreground text-xs">({stats.month_counts[m]})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {browseRows.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Showing {browseRows.length} of {browseTotal.toLocaleString()} · Total: {fmtAmount(browseTotalAmount)}
                  </span>
                )}
              </div>

              {browseLoading && browseRows.length === 0 && (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              )}

              {browseRows.length === 0 && !browseLoading && (
                <p className="text-sm text-muted-foreground text-center py-10">
                  {months.length === 0
                    ? 'No data yet — import a POS file to get started.'
                    : 'Select a month above to browse transactions.'}
                </p>
              )}

              {browseRows.length > 0 && (
                <>
                  <TxTable rows={browseRows} />
                  {browseRows.length < browseTotal && (
                    <Button variant="outline" size="sm" className="w-full" disabled={browseLoading}
                      onClick={() => loadBrowse(browseMonth && browseMonth !== 'all' ? browseMonth : '', browseOffset, true)}>
                      {browseLoading
                        ? 'Loading…'
                        : `Load more (${browseTotal - browseRows.length} remaining)`}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Top Customers tab ── */}
        <TabsContent value="customers">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Top Customers</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Cards ranked by number of transactions — identify your repeat customers.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => loadCustomers(customersMonth)}
                  disabled={loadingCustomers} title="Refresh">
                  <RefreshCw className={`h-4 w-4 ${loadingCustomers ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={customersMonth} onValueChange={(v) => handleCustomersMonthChange(v ?? 'all')}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {loadingCustomers && (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              )}

              {customersLoaded && !loadingCustomers && customers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No data for {customersMonth === 'all' ? 'any month' : customersMonth}.
                </p>
              )}

              {customersLoaded && !loadingCustomers && customers.length > 0 && (
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Rank</TableHead>
                      <TableHead>Card</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Total Spent</TableHead>
                      <TableHead>First Visit</TableHead>
                      <TableHead>Last Visit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((c, i) => {
                      const rank = i + 1
                      return (
                        <TableRow key={c.card_number} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                          <TableCell className="py-2">
                            <Badge variant="outline" className={`font-bold text-xs ${RANK_COLORS[rank] ?? ''}`}>
                              #{rank}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1.5">
                              <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-mono text-xs">{c.card_number}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-right font-semibold">{c.transaction_count}</TableCell>
                          <TableCell className="py-2 text-right font-mono">{fmtAmount(c.total_amount)}</TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">{fmtDate(c.first_seen)}</TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">{fmtDate(c.last_seen)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
