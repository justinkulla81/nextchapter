import { requireAdmin } from '@/lib/admin/auth'
import { getQueuedDigestItems, getDigestSendHistory } from '@/lib/admin/digest-composer'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { toggleQueuedForDigest } from '@/app/support/admin/(portal)/research/actions'
import type { ResearchLibraryItem, DigestSend } from '@prisma/client'

export const maxDuration = 30

const AUDIENCE_LABEL: Record<string, string> = {
  candidate: 'Candidates',
  coach: 'Coaches',
  recruiter: 'Recruiters',
  employer: 'Hiring managers',
}

export default async function AdminDigestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const audienceFilter = params.audience ?? ''
  const q = (params.q ?? '').toLowerCase().trim()

  const [queued, historyRaw] = await Promise.all([
    getQueuedDigestItems(),
    getDigestSendHistory(audienceFilter || undefined),
  ])
  const history = q ? historyRaw.filter((s) => (AUDIENCE_LABEL[s.audience] ?? s.audience).toLowerCase().includes(q)) : historyRaw

  const queueColumns: AdminColumn<ResearchLibraryItem>[] = [
    {
      header: 'Item',
      render: (r) => (
        <div>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            {r.title || r.url}
          </a>
          {r.summary && <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>}
        </div>
      ),
    },
    { header: 'Found', className: 'px-3 py-2 tabular-nums', render: (r) => r.dateFound.toLocaleDateString() },
    {
      header: 'Actions',
      render: (r) => (
        <form action={toggleQueuedForDigest.bind(null, r.id, false)}>
          <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">
            Remove from queue
          </button>
        </form>
      ),
    },
  ]

  const historyColumns: AdminColumn<DigestSend>[] = [
    { header: 'Audience', render: (s) => AUDIENCE_LABEL[s.audience] ?? s.audience },
    { header: 'Sent', className: 'px-3 py-2 tabular-nums', render: (s) => s.sentAt.toLocaleString() },
    { header: 'Recipients', className: 'px-3 py-2 tabular-nums', render: (s) => s.recipientCount },
    { header: 'Items included', className: 'px-3 py-2 tabular-nums', render: (s) => s.itemIds.length },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly Market Digest</h1>
        <p className="mt-1 text-muted-foreground">
          Review what&apos;s queued for the next send, and see the history of past sends per audience.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-medium text-foreground">Queued for next digest ({queued.length})</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Market Brief items queued from the{' '}
          <a href="/support/admin/research" className="underline underline-offset-4">
            Research Library
          </a>
          . Nothing is auto-published — the scheduled send pulls from this queue as-is.
        </p>
        <div className="mt-3">
          <AdminDataTable columns={queueColumns} rows={queued} rowKey={(r) => r.id} emptyMessage="Nothing queued yet." />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-foreground">Send history</h2>
        <div className="mt-3 space-y-3">
          <AdminFilterBar
            basePath="/support/admin/digest"
            searchValue={params.q ?? ''}
            searchPlaceholder="Search by audience…"
            filters={[
              {
                key: 'audience',
                label: 'Audience',
                value: audienceFilter,
                options: Object.entries(AUDIENCE_LABEL).map(([value, label]) => ({ value, label })),
              },
            ]}
          />
          <AdminDataTable columns={historyColumns} rows={history} rowKey={(s) => s.id} emptyMessage="No digests sent yet." />
        </div>
      </div>
    </div>
  )
}
