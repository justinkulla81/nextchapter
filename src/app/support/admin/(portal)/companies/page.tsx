import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { listCompaniesRankedByOutplacementSignal, type RankedCompanyRow } from '@/lib/companies/outplacement-signal'
import { listIntelCoverageGaps } from '@/lib/companies/company-admin-view'
import { isSuppressedCell } from '@/lib/admin/cell-suppression'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const maxDuration = 30

type SortKey = 'name' | 'level' | 'trajectory' | 'currentEmployerCount'

const LEVEL_STYLE: Record<string, string> = {
  HIGH: 'bg-destructive/10 text-destructive',
  MEDIUM: 'bg-warning/10 text-warning',
  LOW: 'bg-muted text-muted-foreground',
}
const TRAJECTORY_RANK: Record<string, number> = { contracting: 2, flat: 1, growing: 0 }

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const sort = (params.sort as SortKey | undefined) ?? 'level'
  const dir = params.dir === 'asc' ? 'asc' : 'desc'

  const [rows, coverageGaps] = await Promise.all([listCompaniesRankedByOutplacementSignal(), listIntelCoverageGaps()])

  function compare(a: RankedCompanyRow, b: RankedCompanyRow): number {
    switch (sort) {
      case 'name':
        return a.companyName.localeCompare(b.companyName)
      case 'trajectory':
        return (a.signal.trajectory ? TRAJECTORY_RANK[a.signal.trajectory] : -1) - (b.signal.trajectory ? TRAJECTORY_RANK[b.signal.trajectory] : -1)
      case 'currentEmployerCount':
        return a.signal.currentEmployerCount - b.signal.currentEmployerCount
      case 'level':
      default:
        return a.signal.compositeScore - b.signal.compositeScore
    }
  }
  const sorted = [...rows].sort((a, b) => (dir === 'asc' ? compare(a, b) : compare(b, a)))

  const highCount = rows.filter((r) => r.signal.level === 'HIGH').length

  const columns: AdminColumn<RankedCompanyRow>[] = [
    {
      header: 'Company',
      sortKey: 'name',
      render: (r) => (
        <Link href={`/support/admin/companies/${r.companyId}`} className="text-primary underline underline-offset-4">
          {r.companyName}
        </Link>
      ),
    },
    { header: 'Industry', render: (r) => r.industry ?? '—' },
    {
      header: 'Outplacement signal',
      sortKey: 'level',
      render: (r) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_STYLE[r.signal.level]}`}>
          {r.signal.level}
        </span>
      ),
    },
    {
      header: 'Trajectory',
      sortKey: 'trajectory',
      render: (r) => r.signal.trajectory ?? 'No signal yet',
    },
    {
      header: 'Current employees',
      sortKey: 'currentEmployerCount',
      className: 'px-3 py-2 tabular-nums',
      render: (r) => r.signal.currentEmployerCount,
    },
    {
      header: 'Currently searching',
      className: 'px-3 py-2 tabular-nums',
      render: (r) => (isSuppressedCell(r.signal.currentlySearchingDisplay) ? 'Insufficient data' : r.signal.currentlySearchingDisplay.count),
    },
    { header: 'WARN', render: () => <span className="text-muted-foreground">Not available</span> },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="mt-1 text-muted-foreground">
          {rows.length} companies, ranked by outplacement pitch signal ({highCount} at HIGH). Composite of postings
          trajectory and member concentration only — WARN filings aren&apos;t available yet (see each company page).
          The &quot;currently searching&quot; column is aggregate-only and suppressed below 5 members; click into a
          company page to view it (each view is logged with a reason).
        </p>
      </div>

      <AdminDataTable
        columns={columns}
        rows={sorted}
        rowKey={(r) => r.companyId}
        emptyMessage="No companies yet."
        sorting={{ currentKey: sort, currentDir: dir, basePath: '/support/admin/companies', baseParams: {} }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Intel coverage gaps</CardTitle>
        </CardHeader>
        <CardContent>
          {coverageGaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No named-target company is missing intel right now.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {coverageGaps.map((g) => (
                <li key={g.companyId} className="flex items-center justify-between">
                  <Link href={`/support/admin/companies/${g.companyId}`} className="text-primary underline underline-offset-4">
                    {g.companyName}
                  </Link>
                  <span className="text-muted-foreground">{g.targetCount} members target this company · 0 published intel</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
