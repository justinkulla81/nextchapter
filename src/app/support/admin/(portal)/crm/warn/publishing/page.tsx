import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatDate } from '@/lib/crm/labels'
import { SITE_URL } from '@/lib/seo/facts'
import { loadPublishingQueue } from '@/lib/warn/publishing-queue'
import { setAnnouncementRss } from '../actions'
import { setIndexRequested, setLinkedInPosted } from './actions'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Google has no push for these pages (its Indexing API is for job postings only), so the manual route is Search Console's
// URL inspection > Request indexing. A handful a day is what it allows.
const GSC_PROPERTY = process.env.GSC_PROPERTY || 'sc-domain:launchyournextchapter.com'
const DAILY_GUIDE = 10
const inspectLink = (url: string) => `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(GSC_PROPERTY)}&id=${encodeURIComponent(url)}`

const BTN = 'h-7 rounded-md border border-border px-2 text-xs font-normal'
const ACT = `${BTN} bg-white text-primary hover:bg-muted`
const DONE = `${BTN} bg-muted text-muted-foreground hover:bg-muted`

export default async function LayoffPublishingPage() {
  await requireAdmin()
  const { rows, requestsLast24h } = await loadPublishingQueue()
  const waiting = rows.filter((r) => !r.indexRequestedAt).length

  return (
    <div className="space-y-6">
      <div>
        <Link href="/support/admin/crm/warn" className="text-sm text-primary underline underline-offset-4">Back to WARN notices</Link>
        <h1 className="mt-2 text-2xl font-semibold">Layoff publishing</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Recent announcements and buyouts, plus new WARN filings naming 100 or more workers. For each: whether it is in the layoff RSS feed, whether it was posted on LinkedIn, and whether you asked Google to index its page. The list puts what to push first at the top.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <p className="font-medium">Google indexing requests, last 24 hours: {requestsLast24h} of about {DAILY_GUIDE}</p>
        <p className="mt-1 text-muted-foreground">
          Search Console limits manual requests to a handful a day. Open a page with the button, choose Request indexing there, then mark it here. {waiting} {waiting === 1 ? 'page is' : 'pages are'} waiting. Bing and other IndexNow search engines are told about every layoff page automatically.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in the last {90} days to publish. Announcements are added in CRM &gt; WARN.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Layoff</th>
                <th className="px-2 py-2 font-medium">Google index</th>
                <th className="px-2 py-2 font-medium">Layoff RSS feed</th>
                <th className="px-2 py-2 font-medium">LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const url = `${SITE_URL}${r.path}`
                return (
                  <tr key={r.noticeId} className="border-b border-border align-top last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5 font-medium">
                        {r.employer}
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">{r.kind === 'announcement' ? 'Announced' : 'WARN filing'}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(r.date)}{r.workers ? ` · ${r.workers.toLocaleString()} workers` : ''}{r.summary ? ` · ${r.summary}` : ''}
                      </p>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block break-all text-xs text-primary underline underline-offset-4">{url}</a>
                    </td>
                    <td className="px-2 py-2">
                      {r.indexRequestedAt ? <p className="mb-1 text-xs text-muted-foreground">Requested {formatDate(r.indexRequestedAt)}</p> : null}
                      <div className="flex flex-wrap gap-1">
                        <a href={inspectLink(url)} target="_blank" rel="noopener noreferrer" className={ACT}>
                          <span className="inline-flex h-full items-center">Open in Search Console</span>
                        </a>
                        <form action={setIndexRequested}>
                          <input type="hidden" name="path" value={r.path} />
                          <input type="hidden" name="requested" value={r.indexRequestedAt ? '0' : '1'} />
                          <SubmitButton variant="outline" size="sm" className={r.indexRequestedAt ? DONE : ACT} savedLabel={r.indexRequestedAt ? 'Cleared' : 'Marked'}>
                            {r.indexRequestedAt ? 'Clear request' : 'Mark as requested'}
                          </SubmitButton>
                        </form>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {r.kind === 'filing' ? (
                        <span className="text-xs text-muted-foreground">In the feed automatically</span>
                      ) : (
                        <>
                          {r.rssPublishedAt ? <p className="mb-1 text-xs text-muted-foreground">Published {formatDate(r.rssPublishedAt)}</p> : <p className="mb-1 text-xs text-muted-foreground">Not in the feed</p>}
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
                      {r.linkedin === 'POSTED' ? (
                        <p className="mb-1 text-xs text-muted-foreground">Posted{r.linkedinPostedAt ? ` ${formatDate(r.linkedinPostedAt)}` : ''}</p>
                      ) : (
                        <p className="mb-1 text-xs text-muted-foreground">{r.linkedin === 'DRAFT' ? 'Draft waiting' : r.linkedin === 'SKIPPED' ? 'Skipped' : 'Not posted'}</p>
                      )}
                      <form action={setLinkedInPosted}>
                        <input type="hidden" name="id" value={r.noticeId} />
                        <input type="hidden" name="posted" value={r.linkedin === 'POSTED' ? '0' : '1'} />
                        <SubmitButton variant="outline" size="sm" className={r.linkedin === 'POSTED' ? DONE : ACT}>
                          {r.linkedin === 'POSTED' ? 'Undo posted' : 'Mark as posted on LinkedIn'}
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                )
              })}
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
