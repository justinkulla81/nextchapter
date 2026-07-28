import Link from 'next/link'
import { getAllCandidateSentiment } from '@/lib/admin/sentiment'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

type SortKey = 'name' | 'sentiment' | 'grade' | 'jobsApplied' | 'networking'

export default async function SentimentAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const sort = (params.sort as SortKey | undefined) ?? 'sentiment'
  const dir = params.dir === 'desc' ? 'desc' : params.dir === 'asc' ? 'asc' : 'asc'

  const rows = await getAllCandidateSentiment()

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
      case 'sentiment':
      default:
        return (a.sentimentScore ?? -1) - (b.sentimentScore ?? -1)
    }
  }
  rows.sort((a, b) => (dir === 'asc' ? compare(a, b) : compare(b, a)))

  const lowSentimentCount = rows.filter((r) => r.lowSentiment).length

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
    { header: 'Email', render: (r) => r.email },
    {
      header: 'Sentiment',
      sortKey: 'sentiment',
      render: (r) =>
        r.sentimentScore === null ? (
          <span className="text-muted-foreground">No check-ins</span>
        ) : (
          <span className={r.lowSentiment ? 'font-semibold text-warning' : 'text-foreground'}>
            {r.sentimentScore}/100{r.lowSentiment ? ' — alert' : ''}
          </span>
        ),
    },
    { header: 'Recent Market Reality Grade', sortKey: 'grade', render: (r) => r.recentGrade ?? '—' },
    {
      header: 'Jobs Applied',
      sortKey: 'jobsApplied',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => r.jobsAppliedCount,
    },
    {
      header: 'Networking Done',
      sortKey: 'networking',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => r.networkingCount,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sentiment</h1>
        <p className="mt-1 text-muted-foreground">
          Every candidate, sorted by trailing-14-day mood sentiment (0–100). {lowSentimentCount} showing a
          sentiment alert right now. Click a name for their full sentiment-over-time graph.
        </p>
      </div>

      <AdminDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No candidates yet."
        sorting={{ currentKey: sort, currentDir: dir, basePath: '/support/admin/sentiment', baseParams: {} }}
      />
    </div>
  )
}
