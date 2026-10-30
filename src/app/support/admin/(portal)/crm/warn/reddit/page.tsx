import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { RedditReply } from '@/components/admin/RedditReply'
import { findThreads } from '@/lib/reddit/threads'
import { redditReply, redditSearchUrl, stateSubreddit, statePostDraft } from '@/lib/reddit/todo'
import { stateName } from '@/lib/seo/states'
import { getPublicNotices } from '@/lib/warn/layoff-pages'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const DAY = 86_400_000
const SHOWN = 10
const nowMs = () => Date.now()
const LINK = 'text-primary underline underline-offset-4'

export default async function RedditTodoPage() {
  await requireAdmin()
  const now = nowMs()
  const all = await getPublicNotices().catch(() => [])
  // Collected in the last three days AND filed in the last 30: a state that posts an old filing late is not news to answer.
  const recent = all.filter((x) => x.fetchedAt.getTime() > now - 3 * DAY && x.noticeDateKnown && x.noticeDate.getTime() > now - 30 * DAY)

  // One notice per employer, the largest first; threads are looked up one at a time to stay polite to Reddit.
  const seen = new Set<string>()
  const top = [...recent].sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0)).filter((x) => (seen.has(x.slug) ? false : (seen.add(x.slug), true))).slice(0, SHOWN)
  const lookups = new Map<string, Awaited<ReturnType<typeof findThreads>>>()
  for (const x of top) lookups.set(x.id, await findThreads(x.employer))
  const blocked = [...lookups.values()].some((l) => l.blocked)

  const week = all.filter((x) => x.noticeDate.getTime() > now - 7 * DAY && x.noticeDate.getTime() <= now)
  const byState = new Map<string, { n: number; w: number }>()
  for (const x of week) {
    const e = byState.get(x.state) ?? { n: 0, w: 0 }
    e.n++
    e.w += x.workers ?? 0
    byState.set(x.state, e)
  }
  const drafts = [...byState].sort((a, b) => b[1].n - a[1].n).slice(0, 3)

  return (
    <div className="space-y-8">
      <div>
        <Link href="/support/admin/crm/warn" className="text-sm text-primary underline underline-offset-4">Back to WARN notices</Link>
        <h1 className="mt-2 text-2xl font-semibold">Reddit to-do</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The largest layoff notices we collected in the last three days, each with Reddit threads about the employer and a reply built only from the filing. Read the reply, edit it so it sounds like you, post it from your own account, then tick Posted. Reddit removes link-only posts and bans accounts that promote a site, so answer people asking, put the facts in the text, and read each subreddit&apos;s rules first. Nothing here posts for you.
        </p>
        {blocked ? <p className="mt-2 max-w-3xl text-sm">Reddit refused some thread lookups from our server, so those rows show a search link instead. Open it in your browser.</p> : null}
      </div>

      <section aria-labelledby="threads">
        <h2 id="threads" className="text-lg font-semibold">Threads to answer</h2>
        {top.length === 0 ? <p className="mt-2 text-sm">No new notices in the last three days.</p> : (
          <ol className="mt-3 space-y-6">
            {top.map((x, i) => {
              const l = lookups.get(x.id)!
              return (
                <li key={x.id} className="border-t border-border pt-4 first:border-0 first:pt-0">
                  <p className="font-medium"><span className="mr-2 text-xs text-muted-foreground">{i + 1}.</span>{x.employer} <span className="text-sm font-normal text-muted-foreground">· {stateName(x.state)}{x.workers ? ` · ${x.workers.toLocaleString()} workers` : ''}</span></p>
                  <p className="mt-1 text-sm">
                    <a href={redditSearchUrl(`${x.employer} layoffs`)} target="_blank" rel="noopener noreferrer" className={LINK}>Search Reddit for this week</a>
                    {' · '}
                    <a href="https://www.reddit.com/r/layoffs/new/" target="_blank" rel="noopener noreferrer" className={LINK}>r/layoffs</a>
                    {' · '}
                    <a href={`https://www.reddit.com/r/${stateSubreddit(x.state)}/`} target="_blank" rel="noopener noreferrer" className={LINK}>r/{stateSubreddit(x.state)}</a>
                    <span className="text-xs text-muted-foreground"> (check it exists)</span>
                  </p>
                  {l.threads.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {l.threads.map((t) => (
                        <li key={t.url}><a href={t.url} target="_blank" rel="noopener noreferrer" className={LINK}>{t.title}</a>{t.sub ? <span className="text-xs text-muted-foreground"> · r/{t.sub}</span> : null}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-sm text-muted-foreground">{l.blocked ? 'Thread lookup was refused; use the search link.' : 'No threads found this week. Worth a post only if a subreddit welcomes it.'}</p>}
                  <RedditReply id={x.id} employer={x.employer} text={redditReply(x)} />
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="posts">
        <h2 id="posts" className="text-lg font-semibold">Post drafts for this week</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">One per state with the most notices. Post in the state&apos;s own subreddit only where its rules allow data posts; otherwise skip it.</p>
        <ul className="mt-3 space-y-5">
          {drafts.map(([code, v]) => {
            const d = statePostDraft(code, v.n, v.w)
            return (
              <li key={code}>
                <p className="text-sm font-medium">{d.title}</p>
                <RedditReply id={`state-${code}`} employer={stateName(code)} text={`${d.title}\n\n${d.body}`} />
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
