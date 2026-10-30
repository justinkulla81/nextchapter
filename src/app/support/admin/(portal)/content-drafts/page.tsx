import { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { ContentDraftCard } from '@/components/admin/ContentDraftCard'
import { CHANNELS, CHANNEL_LABEL, KIND_LABEL, type CardKind, type Versions } from '@/lib/content/card'
import { easternDay } from '@/lib/content/generate'

export const dynamic = 'force-dynamic'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

export default async function ContentDraftsPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requireAdmin()
  const { day: wanted } = await searchParams
  const today = easternDay(new Date())
  const day = wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) ? wanted : today

  const [drafts, days, posted] = await Promise.all([
    prisma.contentDraft.findMany({ where: { day }, orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }], include: { posts: { orderBy: { postedAt: 'asc' } } } }),
    prisma.contentDraft.groupBy({ by: ['day'], orderBy: { day: 'desc' }, take: 10 }),
    prisma.contentDraftPost.groupBy({ by: ['channel'], where: { postedAt: { gte: daysAgo(30) } }, _count: { _all: true } }),
  ])

  // Distinct visitors per draft campaign and source, from the page paths the Visitors pages read.
  const campaigns = drafts.map((d) => d.campaign)
  const visitRows = campaigns.length
    ? await prisma.$queryRaw<{ campaign: string; source: string; n: bigint }[]>(Prisma.sql`
        SELECT substring("path" from 'utm_campaign=([^&#]+)') AS campaign, substring("path" from 'utm_source=([^&#]+)') AS source, COUNT(DISTINCT "ip")::bigint AS n
        FROM "HomepageVisitEvent"
        WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "createdAt" >= ${daysAgo(30)} AND "path" LIKE '%utm_campaign=cd-%'
        GROUP BY 1, 2`).catch(() => [])
    : []
  const visits = new Map<string, Record<string, number>>()
  for (const r of visitRows) visits.set(r.campaign, { ...(visits.get(r.campaign) ?? {}), [r.source]: Number(r.n) })

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-2xl font-semibold">Content drafts</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Posts for {day}, built each morning from our own data: layoffs, AI exposure, AI pay, the job market and benefits deadlines.
          Each has a LinkedIn, X, Reddit, short-video and newsletter version, and an image. Nothing posts by itself: copy it, post it,
          paste the post&apos;s address and mark it posted. Every link is tagged, so the visitors each post brings show on the card.
          {posted.length ? ` Posted in 30 days: ${posted.map((p) => `${CHANNEL_LABEL[p.channel as (typeof CHANNELS)[number]] ?? p.channel} ${p._count._all}`).join(', ')}.` : ''}
        </p>
        <nav className="mt-1 flex flex-wrap gap-2 text-sm" aria-label="Days">
          {days.map((x) => (x.day === day ? <strong key={x.day}>{x.day}</strong> : <a key={x.day} className="underline" href={`/support/admin/content-drafts?day=${x.day}`}>{x.day}</a>))}
        </nav>
      </header>
      {drafts.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          No drafts for {day}. They are made every morning at about 6:30 AM Eastern; the run shows in Job health as content-drafts.
        </p>
      ) : (
        drafts.map((d) => {
          const facts = d.facts as { source?: string }
          return (
            <ContentDraftCard
              key={d.id}
              d={{
                id: d.id, kindLabel: KIND_LABEL[d.kind as CardKind] ?? d.kind, headline: d.headline, big: d.big, bigLabel: d.bigLabel, status: d.status,
                source: facts.source ?? '', versions: d.versions as unknown as Versions, visits: visits.get(d.campaign) ?? {},
                posts: d.posts.map((p) => ({ channel: p.channel, url: p.url, whenLabel: p.postedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }) })),
              }}
            />
          )
        })
      )}
    </div>
  )
}
