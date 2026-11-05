import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getRoleResources } from '@/lib/roles/resources'
import { becauseLine, feedHeadline, filedThisWeek, pickFeedRole } from '@/lib/roles/role-feed-rules'
import { getRoleIndex } from '@/lib/seo/role-figures'
import { conferencePath } from '@/lib/seo/topics'
import { costLabel, whenLabel } from '@/lib/events/format'
import { MEDIA_KIND_LABEL } from '@/lib/roles/media'
import { coursePath } from '@/lib/learning/public-catalog-shared'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { ExpressInterestButton } from '@/components/search-firms/ExpressInterestButton'
import { roleFeedState } from '@/lib/roles/feed-state'
import { leaveRoleFeedAction, setTurnoverMutedAction } from './actions'

export const metadata: Metadata = { title: 'Your role feed' }

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const more = 'text-sm font-medium text-brand underline underline-offset-4'

// Network > Industry and function, for a member whose résumé title or target role is a leadership role with a page. It replaces
// the community list for that member (the communities stay at /dashboard/community). Approved mockup: dev-preview/network/role-feed.
export default async function RoleFeedPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const profile = await getDashboardProfile()
  const { role: asked } = await searchParams
  const state = await roleFeedState(profile.id)
  const role = profile.confidentialSearchMode ? null : pickFeedRole(asked, profile, state.left)
  if (!role) redirect('/dashboard/community')
  const muted = state.muted.has(role.slug)

  const [r, index, interests] = await Promise.all([
    getRoleResources(role),
    getRoleIndex().catch(() => null),
    prisma.recruiterInterest.findMany({ where: { candidateId: profile.id, status: { not: 'WITHDRAWN' } }, select: { firmOrgId: true } }),
  ])
  const interested = new Set(interests.map((i) => i.firmOrgId))
  // Null when the index could not be read, so the page does not claim "0 jobs are open".
  const openJobs = index ? (index.find((s) => s.slug === role.slug)?.jobs ?? null) : null
  const turnover = muted ? null : r.turnover
  const headline = feedHeadline(role, turnover, openJobs)
  const name = role.short
  const fresh = filedThisWeek(turnover?.items ?? [])
  const emailed = !profile.marketDigestOptedOut && profile.notificationTier !== 'MINIMAL'
  const upcoming = (r.conferences?.rows ?? []).slice(0, fresh.length > 0 ? 1 : 2)
  const firms = r.firms.slice(0, 3)

  captureServerEvent(profile.id, 'role_feed_viewed', {
    roleSlug: role.slug,
    headline: headline.kind,
    turnoverThisWeek: fresh.length,
    conferences: upcoming.length,
    recruiters: firms.length,
    openJobs,
  })

  const hasMore = r.media.length > 0 || r.courses.rows.length > 0
  return (
    <div className="space-y-8">
      <PageHeader
        title={`Your ${name} feed`}
        intro={`You are in the ${name} network because ${becauseLine(role, profile)}.${emailed ? ' A short email comes each week.' : ''}`}
        action={
          <form action={leaveRoleFeedAction.bind(null, role.slug)}>
            <button type="submit" className={`${more} cursor-pointer`}>Unsubscribe</button>
          </form>
        }
      />

      <section aria-labelledby="week" className="space-y-3 rounded-2xl border border-border bg-white p-5">
        <h2 id="week" className="font-display text-2xl leading-tight font-semibold text-ink text-balance">{headline.title}</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> {headline.why}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <TrackedAction variant="primary" href={headline.action.href} event="role_feed_action_clicked" properties={{ roleSlug: role.slug, action: 'headline', headline: headline.kind }}>
            {headline.action.label}
          </TrackedAction>
          {(r.turnover || muted) && (
            <form action={setTurnoverMutedAction.bind(null, role.slug, !muted)}>
              <button type="submit" className={`${more} cursor-pointer`}>{muted ? 'Turn turnover news back on' : 'Mute turnover news'}</button>
            </form>
          )}
        </div>
      </section>

      {(fresh.length > 0 || upcoming.length > 0) && (
        <section aria-labelledby="new" className="space-y-3">
          <h2 id="new" className="font-display text-xl font-semibold text-ink">New this week</h2>
          <RowList label="New this week">
            {fresh.map((t) => (
              <ListRow
                key={t.id}
                title={t.company}
                why={t.summary}
                fact={`${t.source === 'sec' ? 'Filed with the SEC' : 'Reported'} on ${day(t.date)}.`}
                actions={
                  <>
                    {t.url && <TrackedAction variant="text" external href={t.url} event="role_feed_action_clicked" properties={{ roleSlug: role.slug, action: 'filing', company: t.company }}>{t.linkLabel}</TrackedAction>}
                    <TrackedAction variant="text" href={`/jobs?q=${encodeURIComponent(t.company)}`} event="role_feed_action_clicked" properties={{ roleSlug: role.slug, action: 'company_jobs', company: t.company }}>See their open jobs</TrackedAction>
                  </>
                }
              />
            ))}
            {upcoming.map((c) => (
              <ListRow
                key={c.id}
                title={c.name}
                why={`${whenLabel(c)}. ${costLabel(c)}`}
                fact={`Tagged for ${role.fn} leaders.`}
                actions={<TrackedAction variant="text" href={conferencePath(c.id)} event="role_feed_action_clicked" properties={{ roleSlug: role.slug, action: 'conference', conferenceId: c.id }}>See the conference</TrackedAction>}
              />
            ))}
          </RowList>
        </section>
      )}

      <section aria-labelledby="recruiters" className="space-y-3">
        <h2 id="recruiters" className="font-display text-xl font-semibold text-ink">Recruiters who place this role</h2>
        {firms.length === 0 ? (
          <EmptyCard title="No firm is searching at your level right now" why={`We count firms from their own public job postings in ${role.fn}. This list fills as firms post searches.`} />
        ) : (
          <RowList label="Recruiters who place this role">
            {firms.map((f) => (
              <ListRow
                key={f.slug}
                title={f.name}
                why={`${f.searches.toLocaleString('en-US')} live ${f.searches === 1 ? 'search' : 'searches'} in ${role.fn} ${f.adjacent ? 'one level below yours' : 'at your level'}.`}
                fact="Counted from its own public job postings."
                actions={
                  <>
                    <ExpressInterestButton orgId={f.orgId} firmName={f.name} source="recommendation" initiallyInterested={interested.has(f.orgId)} />
                    <TrackedAction variant="text" href={`/search-firms/${f.slug}`} event="role_feed_action_clicked" properties={{ roleSlug: role.slug, action: 'firm_searches', firm: f.slug }}>See its searches</TrackedAction>
                  </>
                }
              />
            ))}
          </RowList>
        )}
        {r.firms.length > 3 && <Link href={`/search-firms?fn=${encodeURIComponent(role.fn)}`} className={more}>See all {r.firms.length} firms</Link>}
      </section>

      {hasMore && (
        <details className="rounded-2xl bg-muted/50 px-5 py-3 text-sm text-ink">
          <summary className="cursor-pointer font-semibold">More for this role</summary>
          <ul className="mt-3 space-y-2">
            {r.media.length > 0 && (
              <li>
                <span className="font-semibold">Podcasts and newsletters:</span>{' '}
                {r.media.slice(0, 4).map((m, i) => (
                  <span key={m.url}>{i > 0 ? ', ' : ''}<a href={m.url} target="_blank" rel="noopener noreferrer nofollow" className={more}>{m.name}</a> <span className="text-muted-foreground">({MEDIA_KIND_LABEL[m.kind].toLowerCase()})</span></span>
                ))}
              </li>
            )}
            {r.courses.rows.length > 0 && (
              <li>
                <span className="font-semibold">Training:</span> {r.courses.total} {role.fn} courses.{' '}
                {r.courses.rows.slice(0, 2).map((c, i) => (
                  <span key={c.slug}>{i > 0 ? ', ' : ''}<Link href={coursePath(c)} className={more}>{c.title}</Link></span>
                ))}
              </li>
            )}
          </ul>
          <p className="mt-3 text-muted-foreground">Looking for other communities? <Link href="/dashboard/community" className={more}>Other communities</Link></p>
        </details>
      )}
    </div>
  )
}
