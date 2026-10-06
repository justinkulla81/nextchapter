import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { isReadyToPublish } from '@/lib/news/metadata'
import { setNewsPublished } from '@/app/support/admin/(portal)/digest/actions'
import { NEWS_KINDS } from '@/lib/news/kind'
import { newsTagLabel } from '@/lib/news/tags'
import { CopyLinksButton, EditNewsItemForm, LinkedInShareButton } from './NewsAdminForms'

const KIND_LABEL: Record<string, string> = Object.fromEntries(NEWS_KINDS.map((k) => [k.key, k.label]))

/**
 * What is on the homepage's News section, and the one place to change it.
 *
 * Sits on Market Pulse because that is where links already arrive, but it is
 * its own list: an alert landing in the table below never shows publicly
 * until it is added here.
 */
export async function NewsAdminPanel() {
  const rows = await prisma.researchLibraryItem.findMany({
    where: { newsKind: { not: null } },
    orderBy: [{ newsPublishedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
    take: 300,
    select: {
      id: true, url: true, newsKind: true, newsTitle: true, newsBlurb: true, newsArticleDate: true,
      newsImageUrl: true, newsSource: true, newsPublishedAt: true, newsTags: true, newsTake: true, newsSlug: true,
    },
  })
  // Drafts first (they're waiting on you), then live items in the order the
  // public page shows them: newest article first by the publisher's date.
  const shown = (i: (typeof rows)[number]) => (i.newsArticleDate ?? i.newsPublishedAt ?? new Date(0)).getTime()
  const items = [
    ...rows.filter((i) => !i.newsPublishedAt),
    ...rows.filter((i) => i.newsPublishedAt).sort((a, b) => shown(b) - shown(a)),
  ].slice(0, 100)
  const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
  const live = items.filter((i) => i.newsPublishedAt).length

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Homepage News</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {live} live. The homepage shows the six most recently published articles; the rest are on the News page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CopyLinksButton urls={items.filter((i) => i.newsKind === 'article').map((i) => i.url)} label="Copy article links for NotebookLM" />
          <Link href="/news" target="_blank" className="text-sm text-primary underline underline-offset-4">
            View the News page
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing in News yet. Add a link above with “Show in News” ticked and it goes live with its headline and picture.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((i) => {
            const ready = isReadyToPublish(i)
            const isLive = !!i.newsPublishedAt
            return (
              <li key={i.id} className="p-3">
                <div className="flex flex-wrap items-start gap-3">
                  {i.newsImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.newsImageUrl} alt="" referrerPolicy="no-referrer" loading="lazy"
                      className="h-14 w-24 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      {i.newsKind === 'instagram' || i.newsKind === 'linkedin' ? 'Embed' : 'No picture'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABEL[i.newsKind ?? ''] ?? i.newsKind}
                      {i.newsSource ? ` · ${i.newsSource}` : ''}
                      {' · '}
                      {i.newsArticleDate ? `Published ${day(i.newsArticleDate)}` : 'Published date unknown'}
                      {' · '}
                      {isLive
                        ? `Live since ${i.newsPublishedAt!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}`
                        : 'Draft, not public'}
                    </p>
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-primary underline underline-offset-4">
                      {i.newsTitle || i.url}
                    </a>
                    {i.newsBlurb && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{i.newsBlurb}</p>}
                    {i.newsTags.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">{i.newsTags.map(newsTagLabel).join(' · ')}</p>
                    )}
                    {isLive && i.newsTake && i.newsSlug && (
                      <p className="mt-1 text-xs">
                        <Link href={`/news/${i.newsSlug}`} target="_blank" className="text-primary underline underline-offset-4">
                          Has its own page with our take
                        </Link>
                      </p>
                    )}
                    {isLive && (
                      <p className="mt-1">
                        <LinkedInShareButton compact itemId={i.id} caption={[i.newsTitle, i.url].filter(Boolean).join('\n\n')} />
                      </p>
                    )}
                  </div>
                  <form action={setNewsPublished.bind(null, i.id, !isLive)} className="flex flex-col items-end gap-1">
                    <SubmitButton
                      variant={isLive ? 'outline' : 'default'} size="sm" disabled={!isLive && !ready}
                      pendingLabel={isLive ? 'Unpublishing…' : 'Publishing…'} savedLabel={isLive ? 'Live' : 'Unpublished'}
                    >
                      {isLive ? 'Unpublish' : 'Publish to homepage'}
                    </SubmitButton>
                    {!isLive && !ready && (
                      <p className="max-w-48 text-right text-xs text-muted-foreground">
                        {i.newsKind === 'article' || i.newsKind === 'video'
                          ? 'Add a headline under Edit details to publish.'
                          : 'This link cannot be embedded. Use the link to a single post or episode.'}
                      </p>
                    )}
                  </form>
                </div>
                <details className="mt-2" open={!isLive && !ready && (i.newsKind === 'article' || i.newsKind === 'video')}>
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Edit details</summary>
                  <EditNewsItemForm item={{
                    id: i.id, kind: i.newsKind ?? 'article', title: i.newsTitle, blurb: i.newsBlurb,
                    imageUrl: i.newsImageUrl, source: i.newsSource, tags: i.newsTags, take: i.newsTake,
                    // The date field's value, as the Eastern calendar day.
                    articleDate: i.newsArticleDate ? i.newsArticleDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : '',
                  }} />
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
