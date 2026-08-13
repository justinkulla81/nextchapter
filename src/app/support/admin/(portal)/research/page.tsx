import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import type { ResearchLibraryItem } from '@prisma/client'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { AddResearchItemForm } from '@/components/admin/AddResearchItemForm'
import { getActiveGoogleConnection } from '@/lib/google/connection'
import { markResearchItemStatus, toggleQueuedForDigest, flagProductPositioning, disconnectGoogleInbox } from './actions'

export const maxDuration = 30

const BUCKET_LABEL: Record<string, string> = {
  GUIDE_SEO: 'Guide/SEO source',
  MARKET_BRIEF: 'Market Brief fodder',
  PRODUCT_POSITIONING: 'Product-positioning evidence',
  PR_MEDIA_HOOK: 'PR/media hook',
  PERSONA_RESEARCH: 'Persona-specific research',
}

function formatPersonaTag(tag: string | null): string {
  if (!tag) return '—'
  return tag
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function AdminResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const bucketFilter = params.bucket ?? ''
  const statusFilter = params.status ?? ''
  const credibilityFilter = params.credibility ?? ''
  const q = (params.q ?? '').toLowerCase().trim()
  const googleConnection = await getActiveGoogleConnection()

  const allItems = await prisma.researchLibraryItem.findMany({
    orderBy: { dateFound: 'desc' },
    take: 500,
  })

  const contradicting = allItems.filter((i) => i.contradictsLockedDecision)

  let rows = allItems
  if (bucketFilter) rows = rows.filter((r) => r.bucket === bucketFilter)
  if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)
  if (credibilityFilter) rows = rows.filter((r) => r.credibilityTier === credibilityFilter)
  if (q) {
    rows = rows.filter(
      (r) => r.title?.toLowerCase().includes(q) || r.url.toLowerCase().includes(q) || r.summary?.toLowerCase().includes(q)
    )
  }

  const columns: AdminColumn<ResearchLibraryItem>[] = [
    {
      header: 'Item',
      render: (r) => (
        <div>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            {r.title || r.url}
          </a>
          {r.needsReview && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              Needs review
            </span>
          )}
          {r.fetchFailed && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Could not fetch full content
            </span>
          )}
          {r.summary && <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>}
        </div>
      ),
    },
    { header: 'Bucket', render: (r) => (r.bucket ? BUCKET_LABEL[r.bucket] : '—') },
    { header: 'Persona', render: (r) => formatPersonaTag(r.personaTag) },
    {
      header: 'Confidence',
      className: 'px-3 py-2 tabular-nums',
      render: (r) => (r.confidenceScore != null ? `${Math.round(r.confidenceScore * 100)}%` : '—'),
    },
    { header: 'Credibility', render: (r) => r.credibilityTier ?? '—' },
    { header: 'Source', render: (r) => (r.ingestionSource === 'inbox' ? 'Inbox' : 'Manual') },
    { header: 'Status', render: (r) => r.status },
    {
      header: 'Actions',
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          {r.bucket === 'MARKET_BRIEF' && (
            <form action={toggleQueuedForDigest.bind(null, r.id, !r.queuedForDigest)}>
              <button type="submit" className="text-sm text-primary underline underline-offset-4">
                {r.queuedForDigest ? 'Unqueue from digest' : 'Queue for digest'}
              </button>
            </form>
          )}
          {r.bucket === 'PRODUCT_POSITIONING' && (
            <form action={flagProductPositioning.bind(null, r.id)}>
              <button type="submit" className="text-sm text-primary underline underline-offset-4">
                Flag to copy owner
              </button>
            </form>
          )}
          {r.status !== 'reviewed' && (
            <form action={markResearchItemStatus.bind(null, r.id, 'reviewed')}>
              <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">
                Mark reviewed
              </button>
            </form>
          )}
          {r.status !== 'actioned' && (
            <form action={markResearchItemStatus.bind(null, r.id, 'actioned')}>
              <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">
                Mark actioned
              </button>
            </form>
          )}
          {r.status !== 'dismissed' && (
            <form action={markResearchItemStatus.bind(null, r.id, 'dismissed')}>
              <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">
                Dismiss
              </button>
            </form>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market Pulse</h1>
        <p className="mt-1 text-muted-foreground">
          Every article ingested via the research inbox or manual add — fetched, summarized, and triaged.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
        {googleConnection ? (
          <>
            <p className="text-sm text-foreground">
              Connected to <span className="font-medium">{googleConnection.email}</span>
              {googleConnection.lastSweepAt && (
                <span className="text-muted-foreground"> — last swept {googleConnection.lastSweepAt.toLocaleString()}</span>
              )}
            </p>
            <form action={disconnectGoogleInbox}>
              <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">
                Disconnect
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">No research inbox connected — inbox ingestion is paused.</p>
            <a
              href="/api/google/oauth/start"
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Connect Gmail
            </a>
          </>
        )}
      </div>

      <AddResearchItemForm />

      {contradicting.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">
            {contradicting.length} item{contradicting.length > 1 ? 's' : ''} may contradict a locked product decision
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {contradicting.map((c) => (
              <li key={c.id}>
                <Link href={c.url} className="underline underline-offset-4">
                  {c.title || c.url}
                </Link>
                {' — '}
                {c.summary}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminFilterBar
        basePath="/support/admin/research"
        searchValue={params.q ?? ''}
        searchPlaceholder="Search title, URL, or summary…"
        filters={[
          {
            key: 'bucket',
            label: 'Bucket',
            value: bucketFilter,
            options: Object.entries(BUCKET_LABEL).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            options: [
              { value: 'new', label: 'New' },
              { value: 'reviewed', label: 'Reviewed' },
              { value: 'actioned', label: 'Actioned' },
              { value: 'dismissed', label: 'Dismissed' },
            ],
          },
          {
            key: 'credibility',
            label: 'Credibility',
            value: credibilityFilter,
            options: [
              { value: 'recognized', label: 'Recognized' },
              { value: 'unknown', label: 'Unknown' },
            ],
          },
        ]}
      />

      <AdminDataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="No research items match." />
    </div>
  )
}
