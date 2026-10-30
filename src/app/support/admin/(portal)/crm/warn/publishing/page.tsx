import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatDate } from '@/lib/crm/labels'
import { SITE_URL } from '@/lib/seo/facts'
import { loadPublishingQueue, type PublishingRow } from '@/lib/warn/publishing-queue'
import { DAILY_INDEX_LIMIT, applyFilters, dailyPicks, readFilters, type Filters } from '@/lib/warn/publishing-rules'
import { setAnnouncementRss } from '../actions'
import { postFilingToX, setIndexRequested, setLinkedInPosted } from './actions'
import { xConfigured } from '@/lib/social/clients'
import { filingPostText } from '@/lib/social/posts'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Google has no push for these pages (its Indexing API is for job postings only), so the manual route is Search Console's
// URL inspection > Request indexing. A handful a day is what it allows.
const GSC_PROPERTY = process.env.GSC_PROPERTY || 'sc-domain:launchyournextchapter.com'
// Search Console has no link that opens a URL's inspection by its address (the inspect page takes an opaque id and answers 404 to a
// guessed one), so the button opens the property and the address shown under each layoff is pasted into its inspect box at the top.
const searchConsoleLink = () => `https://search.google.com/search-console?resource_id=${encodeURIComponent(GSC_PROPERTY)}`
const BASE = '/support/admin/crm/warn/publishing'

const BTN = 'inline-flex h-7 items-center rounded-md border border-border px-2 text-xs font-normal'
const ACT = `${BTN} bg-white text-primary hover:bg-muted`
const DONE = `${BTN} bg-muted text-muted-foreground hover:bg-muted`
const TYPE_LABEL = { warn: 'WARN filing', news: 'News', buyout: 'Buyout' } as const

const TYPES = [['all', 'All types'], ['warn', 'WARN'], ['news', 'News'], ['buyout', 'Buyout']] as const
const WHERES = [['us', 'U.S. only'], ['all', 'Everywhere']] as const
const SORTS = [['priority', 'Push first'], ['size', 'Largest'], ['newest', 'Newest']] as const

function href(f: Filters, change: Partial<Filters>): string {
  const n = { ...f, ...change }
  const q = new URLSearchParams()
  if (n.type !== 'all') q.set('type', n.type)
  if (n.where !== 'us') q.set('where', n.where)
  if (n.sort !== 'priority') q.set('sort', n.sort)
  const s = q.toString()
  return s ? `${BASE}?${s}` : BASE
}

function ButtonGroup<T extends string>({ label, options, current, make }: { label: string; options: readonly (readonly [T, string])[]; current: T; make: (v: T) => string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {options.map(([value, text]) => (
          <Link key={value} href={make(value)} aria-current={value === current ? 'true' : undefined} className={value === current ? `${BTN} border-primary bg-primary text-primary-foreground` : ACT}>
            {text}
          </Link>
        ))}
      </div>
    </div>
  )
}

function IndexActions({ r }: { r: PublishingRow }) {
  const url = `${SITE_URL}${r.path}`
  return (
    <div className="flex flex-wrap gap-1">
      <a href={searchConsoleLink()} target="_blank" rel="noopener noreferrer" className={ACT} title="Opens Search Console. Paste the address into the box at the top, press Enter, then choose Request indexing.">Open Search Console</a>
      <form action={setIndexRequested}>
        <input type="hidden" name="path" value={r.path} />
        <input type="hidden" name="requested" value={r.indexRequestedAt ? '0' : '1'} />
        <SubmitButton variant="outline" size="sm" className={r.indexRequestedAt ? DONE : ACT} savedLabel={r.indexRequestedAt ? 'Cleared' : 'Marked'}>
          {r.indexRequestedAt ? 'Clear request' : 'Mark as requested'}
        </SubmitButton>
      </form>
    </div>
  )
}

function LayoffCell({ r }: { r: PublishingRow }) {
  const url = `${SITE_URL}${r.path}`
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 font-medium">
        {r.employer}
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">{TYPE_LABEL[r.type]}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">{r.state ?? 'Non-U.S.'}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatDate(r.date)}{r.workers ? ` · ${r.workers.toLocaleString()} workers` : ''}{r.summary ? ` · ${r.summary}` : ''}
      </p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block break-all text-xs text-primary underline underline-offset-4">{url}</a>
    </>
  )
}

export default async function LayoffPublishingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const filters = readFilters(await searchParams)
  const { rows, requestsLast24h } = await loadPublishingQueue()
  const picks = dailyPicks(rows, requestsLast24h)
  const shown = applyFilters(rows, filters)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/support/admin/crm/warn" className="text-sm text-primary underline underline-offset-4">Back to WARN notices</Link>
        <h1 className="mt-2 text-2xl font-semibold">Layoff publishing</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Recent news-reported layoffs and buyouts, plus new WARN filings naming 100 or more workers. For each: whether it is in the layoff RSS feed, whether it was posted on LinkedIn, and whether you asked Google to index its page.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-muted/40 p-4">
        <h2 className="text-base font-semibold">Today&apos;s Google indexing picks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {requestsLast24h} of {DAILY_INDEX_LIMIT} requested in the last 24 hours. Each day the list is the largest U.S. layoffs from the last 48 hours first, then the largest remaining, not yet requested. Open a page, choose Request indexing in Search Console, then mark it here. Bing and other IndexNow search engines are told about every layoff page automatically.
        </p>
        {picks.length === 0 ? (
          <p className="mt-3 text-sm">{requestsLast24h >= DAILY_INDEX_LIMIT ? 'Today’s ten are done.' : 'No U.S. layoff is waiting for a request.'}</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {picks.map((r, i) => (
              <li key={r.noticeId} className="flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
                <div className="min-w-0 flex-1"><span className="mr-2 text-xs text-muted-foreground">{i + 1}.</span><div className="inline-block align-top"><LayoffCell r={r} /></div></div>
                <IndexActions r={r} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <ButtonGroup label="Where" options={WHERES} current={filters.where} make={(v) => href(filters, { where: v })} />
        <ButtonGroup label="Type" options={TYPES} current={filters.type} make={(v) => href(filters, { type: v })} />
        <ButtonGroup label="Order" options={SORTS} current={filters.sort} make={(v) => href(filters, { sort: v })} />
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches these filters. Choose Everywhere or All types to widen them.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Layoff ({shown.length})</th>
                <th className="px-2 py-2 font-medium">Google index</th>
                <th className="px-2 py-2 font-medium">Layoff RSS feed</th>
                <th className="px-2 py-2 font-medium">LinkedIn</th>
                <th className="px-2 py-2 font-medium">X</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.noticeId} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2"><LayoffCell r={r} /></td>
                  <td className="px-2 py-2">
                    {r.indexRequestedAt ? <p className="mb-1 text-xs text-muted-foreground">Requested {formatDate(r.indexRequestedAt)}</p> : null}
                    <IndexActions r={r} />
                  </td>
                  <td className="px-2 py-2">
                    {r.kind === 'filing' ? (
                      <span className="text-xs text-muted-foreground">In the feed automatically</span>
                    ) : (
                      <>
                        <p className="mb-1 text-xs text-muted-foreground">{r.rssPublishedAt ? `Published ${formatDate(r.rssPublishedAt)}` : 'Not in the feed'}</p>
                        <form action={setAnnouncementRss}>
                          <input type="hidden" name="id" value={r.noticeId} />
                          <input type="hidden" name="publish" value={r.rssPublishedAt ? '0' : '1'} />
                          <SubmitButton variant="outline" size="sm" className={r.rssPublishedAt ? DONE : ACT}>
                            {r.rssPublishedAt ? 'Remove from RSS' : 'Publish to RSS'}
                          </SubmitButton>
                        </form>
                      </>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <p className="mb-1 text-xs text-muted-foreground">
                      {r.linkedin === 'POSTED' ? `Posted${r.linkedinPostedAt ? ` ${formatDate(r.linkedinPostedAt)}` : ''}` : r.linkedin === 'DRAFT' ? 'Draft waiting' : r.linkedin === 'SKIPPED' ? 'Skipped' : 'Not posted'}
                    </p>
                    <form action={setLinkedInPosted}>
                      <input type="hidden" name="id" value={r.noticeId} />
                      <input type="hidden" name="posted" value={r.linkedin === 'POSTED' ? '0' : '1'} />
                      <SubmitButton variant="outline" size="sm" className={r.linkedin === 'POSTED' ? DONE : ACT}>
                        {r.linkedin === 'POSTED' ? 'Undo posted' : 'Mark as posted on LinkedIn'}
                      </SubmitButton>
                    </form>
                  </td>
                  <td className="px-2 py-2">
                    {r.kind !== 'filing' ? (
                      <span className="text-xs text-muted-foreground">Press reports and buyouts wait for a second source</span>
                    ) : r.xPostedAt ? (
                      <span className="text-xs text-muted-foreground">Posted {formatDate(r.xPostedAt)}</span>
                    ) : !xConfigured() ? (
                      <span className="text-xs text-muted-foreground">X is not connected yet</span>
                    ) : (
                      <form action={postFilingToX} className="space-y-1">
                        <input type="hidden" name="id" value={r.noticeId} />
                        <input type="hidden" name="path" value={r.path} />
                        <p className="max-w-xs text-xs text-muted-foreground">{filingPostText({ employer: r.employer, state: r.state, workers: r.workers, date: r.date, path: r.path }, 'utm_source=x&utm_medium=social&utm_campaign=warn-filing')}</p>
                        <SubmitButton variant="outline" size="sm" className={ACT} savedLabel="Posted">Post to X</SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        The LinkedIn drafts and their text are in the <Link href="/support/admin/linkedin-drafts" className="text-primary underline underline-offset-4">LinkedIn drafts queue</Link>.
      </p>
    </div>
  )
}
