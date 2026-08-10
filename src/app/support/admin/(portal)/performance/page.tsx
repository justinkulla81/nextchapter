import Link from 'next/link'
import { getAllCandidatePerformance, PERFORMANCE_STATUS_RANK, type PerformanceStatus } from '@/lib/admin/performance'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

type SortKey =
  | 'name'
  | 'grade'
  | 'jobsApplied'
  | 'networking'
  | 'actionsDone'
  | 'gmailConnected'
  | 'daysSinceRegistration'
  | 'totalCheckIns'
  | 'checkInsPastWeek'
  | 'status'

const STATUS_LABEL: Record<PerformanceStatus, string> = { green: 'Green', yellow: 'Yellow', red: 'Red' }
const STATUS_DOT: Record<PerformanceStatus, string> = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-destructive',
}

export default async function PerformanceAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const sort = (params.sort as SortKey | undefined) ?? 'status'
  const dir = params.dir === 'desc' ? 'desc' : params.dir === 'asc' ? 'asc' : 'asc'

  const rows = await getAllCandidatePerformance()

  const GRADE_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 }
  function compare(a: (typeof rows)[number], b: (typeof rows)[number]): number {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'grade':
        return (a.recentGrade ? GRADE_RANK[a.recentGrade] : 0) - (b.recentGrade ? GRADE_RANK[b.recentGrade] : 0)
      case 'jobsApplied':
        return a.jobsAppliedCount - b.jobsAppliedCount
      case 'networking':
        return a.networkingCount - b.networkingCount
      case 'actionsDone':
        return a.actionsDoneCount - b.actionsDoneCount
      case 'gmailConnected':
        return Number(a.gmailConnected) - Number(b.gmailConnected)
      case 'daysSinceRegistration':
        return (a.daysSinceRegistration ?? -1) - (b.daysSinceRegistration ?? -1)
      case 'totalCheckIns':
        return a.totalCheckIns - b.totalCheckIns
      case 'checkInsPastWeek':
        return a.checkInsPastWeek - b.checkInsPastWeek
      case 'status':
      default:
        return PERFORMANCE_STATUS_RANK[a.status] - PERFORMANCE_STATUS_RANK[b.status]
    }
  }
  rows.sort((a, b) => (dir === 'asc' ? compare(a, b) : compare(b, a)))

  const lowSentimentCount = rows.filter((r) => r.lowSentiment).length
  const redCount = rows.filter((r) => r.status === 'red').length

  const columns: AdminColumn<(typeof rows)[number]>[] = [
    {
      header: 'Name',
      sortKey: 'name',
      render: (r) => (
        <Link href={`/support/admin/candidates/${r.id}`} className="text-primary underline underline-offset-4">
          {r.name}
        </Link>
      ),
    },
    {
      header: 'Email',
      className: 'max-w-[160px] truncate',
      render: (r) => (
        <span className="block max-w-[160px] truncate" title={r.email}>
          {r.email}
        </span>
      ),
    },
    {
      header: 'Status',
      sortKey: 'status',
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[r.status]}`} aria-hidden="true" />
          {STATUS_LABEL[r.status]}
        </span>
      ),
    },
    {
      header: 'Days Since',
      sortKey: 'daysSinceRegistration',
      className: 'px-3 py-2 tabular-nums',
      render: (r) => r.daysSinceRegistration ?? '—',
    },
    {
      header: 'Total Check-ins',
      sortKey: 'totalCheckIns',
      className: 'px-3 py-2 tabular-nums',
      render: (r) => r.totalCheckIns,
    },
    {
      header: 'Check-ins Past Week',
      sortKey: 'checkInsPastWeek',
      className: 'px-3 py-2 tabular-nums',
      render: (r) => r.checkInsPastWeek,
    },
    { header: 'Market Reality', sortKey: 'grade', render: (r) => r.recentGrade ?? '—' },
    {
      header: 'Gmail',
      sortKey: 'gmailConnected',
      render: (r) => (r.gmailConnected ? 'Yes' : 'No'),
    },
    {
      header: 'Actions',
      sortKey: 'actionsDone',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => r.actionsDoneCount,
    },
    {
      header: 'Jobs',
      sortKey: 'jobsApplied',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => r.jobsAppliedCount,
    },
    {
      header: 'Networking',
      sortKey: 'networking',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => r.networkingCount,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="mt-1 text-muted-foreground">
          {rows.length} candidates. {redCount} showing a red status right now, {lowSentimentCount} with a sentiment
          alert. Status is computed from sentiment, actions done, jobs applied, networking, and Gmail connection —
          click a column header to sort.
        </p>
      </div>

      <AdminDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No candidates yet."
        sorting={{ currentKey: sort, currentDir: dir, basePath: '/support/admin/performance', baseParams: {} }}
      />
    </div>
  )
}
