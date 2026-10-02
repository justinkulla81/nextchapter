import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { isReadyToPublish } from '@/lib/news/metadata'
import { setNewsPublished } from '@/app/support/admin/(portal)/digest/actions'
import { AddNewsItemForm, EditNewsItemForm } from './NewsAdminForms'

const KIND_LABEL: Record<string, string> = { article: 'Article', video: 'Video', instagram: 'Instagram' }

/**
 * What is on the homepage's News section, and the one place to change it.
 *
 * Sits on Market Pulse because that is where links already arrive, but it is
 * its own list: an alert landing in the table below never shows publicly
 * until it is added here.
 */
export async function NewsAdminPanel() {
  const items = await prisma.researchLibraryItem.findMany({
    where: { newsKind: { not: null } },
    // Drafts first — they are the ones waiting on you.
    orderBy: [{ newsPublishedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true, url: true, newsKind: true, newsTitle: true, newsBlurb: true,
      newsImageUrl: true, newsSource: true, newsPublishedAt: true,
    },
  })
  const live = items.filter((i) => i.newsPublishedAt).length

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Homepage News</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {live} live. The homepage shows the newest six; the rest are on the News page.
          </p>
        </div>
        <Link href="/news" target="_blank" className="text-sm text-primary underline underline-offset-4">
          View the News page
        </Link>
      </div>

      <AddNewsItemForm />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing in News yet. Paste a link above and it goes live with its headline and picture.
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
                      {i.newsKind === 'instagram' ? 'Embed' : 'No picture'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABEL[i.newsKind ?? ''] ?? i.newsKind}
                      {i.newsSource ? ` · ${i.newsSource}` : ''}
                      {' · '}
                      {isLive
                        ? `Live since ${i.newsPublishedAt!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}`
                        : 'Draft, not public'}
                    </p>
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-primary underline underline-offset-4">
                      {i.newsTitle || i.url}
                    </a>
                    {i.newsBlurb && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{i.newsBlurb}</p>}
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
                        {i.newsKind === 'instagram'
                          ? 'This is not a post or reel link, so Instagram cannot embed it.'
                          : 'Add a headline under Edit details to publish.'}
                      </p>
                    )}
                  </form>
                </div>
                <details className="mt-2" open={!isLive && !ready && i.newsKind !== 'instagram'}>
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Edit details</summary>
                  <EditNewsItemForm item={{
                    id: i.id, kind: i.newsKind ?? 'article', title: i.newsTitle, blurb: i.newsBlurb,
                    imageUrl: i.newsImageUrl, source: i.newsSource,
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
