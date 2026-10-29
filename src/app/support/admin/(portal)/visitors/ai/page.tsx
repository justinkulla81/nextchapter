import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { monthlyCapUsd, OUR_DOMAIN } from '@/lib/ai-visibility/run'
import { CITATION_PROMPTS } from '@/lib/ai-visibility/prompts'
import { PROVIDERS } from '@/lib/ai-visibility/providers'
import { classifyTrafficSource, trafficSourceGroup } from '@/lib/marketing/classify-traffic-source'
import { classifyUserAgent } from '@/lib/http/user-agent'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

// Module-level, not inline in the component: react-hooks/purity flags Date.now().
function now(): Date {
  return new Date()
}

export default async function AdminAiAssistantsPage() {
  await requireAdmin()
  const since = new Date(now().getTime() - 30 * DAY_MS)

  const [crawlers, topPaths, runs, referrals] = await Promise.all([
    prisma.aiCrawlerHit.groupBy({ by: ['bot', 'vendor', 'purpose'], where: { day: { gte: since } }, _sum: { hits: true }, _count: { path: true }, orderBy: { _sum: { hits: 'desc' } } }),
    prisma.aiCrawlerHit.groupBy({ by: ['path'], where: { day: { gte: since }, purpose: { in: ['SEARCH', 'USER_FETCH'] } }, _sum: { hits: true }, orderBy: { _sum: { hits: 'desc' } }, take: 15 }),
    prisma.aiCitationRun.findMany({ orderBy: { startedAt: 'desc' }, take: 6, include: { results: { select: { provider: true, cited: true, mentioned: true, error: true } } } }),
    // Only rows that could be AI: an AI utm tag or an AI assistant referrer, so the scan stays small.
    prisma.homepageVisitEvent.findMany({
      where: {
        eventType: 'PAGE_VIEW',
        createdAt: { gte: since },
        OR: [
          { path: { contains: 'utm_source=', mode: 'insensitive' } },
          { referrer: { not: null } },
        ],
        NOT: { referrer: { contains: 'launchyournextchapter.com' } },
      },
      select: { path: true, referrer: true, userAgent: true, ip: true },
      take: 20000,
    }),
  ])

  const byAssistant = new Map<string, { views: number; people: Set<string> }>()
  for (const e of referrals) {
    const label = classifyTrafficSource(e.path, e.referrer)
    if (trafficSourceGroup(label) !== 'AI assistants' || classifyUserAgent(e.userAgent) === 'bot') continue
    const row = byAssistant.get(label) ?? { views: 0, people: new Set<string>() }
    row.views++
    if (e.ip) row.people.add(e.ip)
    byAssistant.set(label, row)
  }

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const spent = await prisma.aiCitationResult.aggregate({ _sum: { estCostUsd: true }, where: { createdAt: { gte: monthStart } } })
  const latest = runs[0]
  const enabled = PROVIDERS.filter((p) => p.enabled()).map((p) => p.id)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">AI assistants</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visits that came from ChatGPT, Claude, Perplexity, Gemini and others, which AI crawlers read the site, and whether the assistants cite {OUR_DOMAIN}. Last 30 days.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-medium">Visits from AI assistants (humans)</h2>
        {byAssistant.size === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None in the last 30 days.</p>
        ) : (
          <table className="mt-2 w-full max-w-xl text-sm">
            <thead><tr className="text-left"><th>Assistant</th><th>Page views</th><th>People</th></tr></thead>
            <tbody>
              {[...byAssistant.entries()].sort((a, b) => b[1].views - a[1].views).map(([label, r]) => (
                <tr key={label}><td>{label}</td><td>{r.views}</td><td>{r.people.size}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium">AI crawlers on the site</h2>
        <p className="mt-1 text-sm text-muted-foreground">Training bots collect pages for models. Search and user-fetch bots are the ones that put a page in an answer.</p>
        {crawlers.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No AI crawler hits recorded yet. Logging starts when this deploys.</p>
        ) : (
          <table className="mt-2 w-full max-w-3xl text-sm">
            <thead><tr className="text-left"><th>Bot</th><th>Company</th><th>Type</th><th>Fetches</th><th>Pages</th></tr></thead>
            <tbody>
              {crawlers.map((c) => (
                <tr key={c.bot}><td>{c.bot}</td><td>{c.vendor}</td><td>{c.purpose.toLowerCase().replace('_', ' ')}</td><td>{c._sum.hits ?? 0}</td><td>{c._count.path}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {topPaths.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-medium">Pages read by search and user-fetch bots</h3>
            <ul className="mt-1 text-sm">
              {topPaths.map((p) => (<li key={p.path}>{p.path} — {p._sum.hits}</li>))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium">Citation check (weekly, Mondays)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {CITATION_PROMPTS.length} questions asked of each assistant with web search on. Providers live: {enabled.length ? enabled.join(', ') : 'none'}. Estimated spend this month ${Number(spent._sum.estCostUsd ?? 0).toFixed(2)} of ${monthlyCapUsd()} cap. Add PERPLEXITY_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY to switch on more assistants.
        </p>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No run yet.</p>
        ) : (
          <table className="mt-2 w-full max-w-3xl text-sm">
            <thead><tr className="text-left"><th>Run</th><th>Assistant</th><th>Questions</th><th>We were cited</th><th>We were named</th><th>Errors</th></tr></thead>
            <tbody>
              {runs.flatMap((run) => {
                const by = new Map<string, { n: number; cited: number; named: number; err: number }>()
                for (const r of run.results) {
                  const row = by.get(r.provider) ?? { n: 0, cited: 0, named: 0, err: 0 }
                  row.n++
                  if (r.cited) row.cited++
                  if (r.mentioned) row.named++
                  if (r.error) row.err++
                  by.set(r.provider, row)
                }
                return [...by.entries()].map(([prov, r]) => (
                  <tr key={`${run.id}-${prov}`}><td>{run.startedAt.toISOString().slice(0, 10)}</td><td>{prov}</td><td>{r.n}</td><td>{r.cited}</td><td>{r.named}</td><td>{r.err}</td></tr>
                ))
              })}
            </tbody>
          </table>
        )}
        {latest?.skippedForCap && <p className="mt-2 text-sm text-destructive">The last run stopped early at the monthly cap.</p>}
      </section>
    </div>
  )
}
