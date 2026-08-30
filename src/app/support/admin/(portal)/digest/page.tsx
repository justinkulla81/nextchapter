import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import type { ResearchLibraryItem, DigestSend, DigestAudience } from '@prisma/client'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { AddResearchItemForm } from '@/components/admin/AddResearchItemForm'
import { DigestAudienceFilter } from '@/components/admin/DigestAudienceFilter'
import { DigestAudienceCheckboxes } from '@/components/admin/DigestAudienceCheckboxes'
import { getActiveGoogleConnection } from '@/lib/google/connection'
import {
  getQueuedDigestItems,
  getDigestSendHistory,
  getSentDigestItems,
  resolveDigestRecipientName,
} from '@/lib/admin/digest-composer'
import { markResearchItemStatus, removeFromDigestQueue, flagProductPositioning, disconnectGoogleInbox } from './actions'

export const maxDuration = 30

const BUCKET_LABEL: Record<string, string> = {
  GUIDE_SEO: 'Guide/SEO source',
  MARKET_BRIEF: 'Market Brief fodder',
  PRODUCT_POSITIONING: 'Product-positioning evidence',
  PR_MEDIA_HOOK: 'PR/media hook',
  PERSONA_RESEARCH: 'Persona-specific research',
}

// Weekly Market Digest — merged into this page rather than living at its
// own route: both views operate on the same ResearchLibraryItem rows
// (digestAudiences, toggled right in the Actions column above), so
// splitting them across two pages just meant clicking back and forth to
// see what queuing an item actually did. The three per-audience sends
// (coaches/recruiters/employers) plus the candidate Market Update are real,
// live sends — coaches/recruiters/employers every Tuesday at
// 14:30/15:00/15:30 UTC (see vercel.json), candidates via the daily
// dispatch cron — not the "Coming soon" the old nav label implied.
const DIGEST_AUDIENCE_LABEL: Record<string, string> = {
  candidate: 'Candidates',
  coach: 'Coaches',
  recruiter: 'Recruiters',
  employer: 'Employers',
}

const DIGEST_AUDIENCE_ENUM_LABEL: Record<DigestAudience, string> = {
  CANDIDATE: 'Candidates',
  COACH: 'Coaches',
  RECRUITER: 'Recruiters',
  EMPLOYER: 'Employers',
}

function formatPersonaTag(tag: string | null): string {
  if (!tag) return '—'
  return tag
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function AudienceBadges({ audiences }: { audiences: DigestAudience[] }) {
  if (audiences.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {audiences.map((a) => (
        <span key={a} className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
          {DIGEST_AUDIENCE_ENUM_LABEL[a]}
        </span>
      ))}
    </div>
  )
}

export default async function AdminDigestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const bucketFilter = params.bucket ?? ''
  const statusFilter = params.status ?? ''
  const credibilityFilter = params.credibility ?? ''
  const digestAudienceFilter = params.digestAudience ?? ''
  const q = (params.q ?? '').toLowerCase().trim()

  const [googleConnection, allItems, queuedForDigest, digestHistory, sentItems, recentClicks] = await Promise.all([
    getActiveGoogleConnection(),
    prisma.researchLibraryItem.findMany({
      orderBy: { dateFound: 'desc' },
      take: 500,
    }),
    getQueuedDigestItems(),
    getDigestSendHistory(digestAudienceFilter || undefined),
    getSentDigestItems(),
    prisma.digestClickEvent.findMany({ orderBy: { clickedAt: 'desc' }, take: 50 }),
  ])

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

  // Batched once for every send's itemIds shown below, rather than a
  // per-row lookup — history is capped at 50 sends, each with a handful of
  // items at most, so this is one small query either way.
  const historyItemIds = [...new Set(digestHistory.flatMap((s) => s.itemIds))]
  const historyItems = historyItemIds.length
    ? await prisma.researchLibraryItem.findMany({ where: { id: { in: historyItemIds } }, select: { id: true, title: true, url: true } })
    : []
  const historyItemById = new Map(historyItems.map((i) => [i.id, i]))

  const clickItemIds = [...new Set(recentClicks.map((c) => c.itemId))]
  const clickItems = clickItemIds.length
    ? await prisma.researchLibraryItem.findMany({ where: { id: { in: clickItemIds } }, select: { id: true, title: true, url: true } })
    : []
  const clickItemById = new Map(clickItems.map((i) => [i.id, i]))
  const recipientNames = await Promise.all(
    recentClicks.map((c) => resolveDigestRecipientName(c.audience, c.recipientId))
  )

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
    {
      header: 'Digest audiences',
      render: (r) => <DigestAudienceCheckboxes itemId={r.id} current={r.digestAudiences} />,
    },
    {
      header: 'Triage',
      render: (r) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{r.status}</span>
          <div className="flex flex-wrap gap-2">
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
        </div>
      ),
    },
  ]

  const digestQueueColumns: AdminColumn<ResearchLibraryItem>[] = [
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
    { header: 'Audiences', render: (r) => <AudienceBadges audiences={r.digestAudiences} /> },
    { header: 'Found', className: 'px-3 py-2 tabular-nums', render: (r) => r.dateFound.toLocaleDateString() },
    {
      header: 'Actions',
      render: (r) => (
        <form action={removeFromDigestQueue.bind(null, r.id)}>
          <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">
            Remove from queue
          </button>
        </form>
      ),
    },
  ]

  const digestHistoryColumns: AdminColumn<DigestSend>[] = [
    { header: 'Audience', render: (s) => DIGEST_AUDIENCE_LABEL[s.audience] ?? s.audience },
    { header: 'Sent', className: 'px-3 py-2 tabular-nums', render: (s) => s.sentAt.toLocaleString() },
    { header: 'Recipients', className: 'px-3 py-2 tabular-nums', render: (s) => s.recipientCount },
    {
      header: 'Articles included',
      render: (s) =>
        s.itemIds.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="space-y-1">
            {s.itemIds.map((id) => {
              const item = historyItemById.get(id)
              return (
                <li key={id} className="text-sm">
                  {item ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                      {item.title || item.url}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{id}</span>
                  )}
                </li>
              )
            })}
          </ul>
        ),
    },
  ]

  const sentItemColumns: AdminColumn<ResearchLibraryItem>[] = [
    {
      header: 'Item',
      render: (r) => (
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
          {r.title || r.url}
        </a>
      ),
    },
    { header: 'Sent to', render: (r) => <AudienceBadges audiences={r.sentAudiences} /> },
    { header: 'First sent', className: 'px-3 py-2 tabular-nums', render: (r) => r.sentAt?.toLocaleDateString() ?? '—' },
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
        basePath="/support/admin/digest"
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

      <div className="space-y-6 border-t border-border pt-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Weekly Market Digest</h2>
          <p className="mt-1 text-muted-foreground">
            Real, scheduled sends — coaches, recruiters, and employers every Tuesday (14:30/15:00/15:30
            UTC), candidates via the daily dispatch — each pulling the queued item(s) below into that
            audience&apos;s own digest email. Nothing here is auto-published; picking an audience above
            is what puts an article in reach of its next send. An item drops out of the queue on its
            own the first time it&apos;s actually sent (see &quot;Sent articles&quot; below).
          </p>
        </div>

        <div>
          <h3 className="text-lg font-medium text-foreground">Queued, not yet sent ({queuedForDigest.length})</h3>
          <div className="mt-3">
            <AdminDataTable
              columns={digestQueueColumns}
              rows={queuedForDigest}
              rowKey={(r) => r.id}
              emptyMessage="Nothing queued yet — pick an audience for an item above."
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-foreground">Send history</h3>
          <div className="mt-3 space-y-3">
            {/* Not AdminFilterBar — that component's search box hardcodes
                name="q", which the Market Pulse table above already owns;
                reusing it here would blank out that search on every audience
                change. This preserves the page's other filters via hidden
                inputs instead. */}
            <DigestAudienceFilter
              q={params.q ?? ''}
              bucket={bucketFilter}
              status={statusFilter}
              credibility={credibilityFilter}
              digestAudience={digestAudienceFilter}
            />
            <AdminDataTable
              columns={digestHistoryColumns}
              rows={digestHistory}
              rowKey={(s) => s.id}
              emptyMessage="No digests sent yet."
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-foreground">Sent articles, ever ({sentItems.length})</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Every article that has gone out in any send, across all audiences and all time — independent
            of the current queue above.
          </p>
          <div className="mt-3">
            <AdminDataTable
              columns={sentItemColumns}
              rows={sentItems}
              rowKey={(r) => r.id}
              emptyMessage="Nothing sent yet."
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-foreground">Recent clicks</h3>
          <p className="mt-1 text-sm text-muted-foreground">Who clicked which article, from a digest email.</p>
          <div className="mt-3 divide-y divide-border rounded-lg border border-border">
            {recentClicks.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No clicks recorded yet.</p>
            ) : (
              recentClicks.map((click, i) => {
                const item = clickItemById.get(click.itemId)
                return (
                  <div key={click.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <div>
                      <span className="font-medium text-foreground">{recipientNames[i]}</span>
                      <span className="text-muted-foreground"> ({DIGEST_AUDIENCE_ENUM_LABEL[click.audience]}) clicked </span>
                      {item ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                          {item.title || item.url}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">an unknown article</span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{click.clickedAt.toLocaleString()}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
