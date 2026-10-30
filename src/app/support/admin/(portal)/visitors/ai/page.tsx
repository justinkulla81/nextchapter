import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { monthlyCapUsd, OUR_DOMAIN } from '@/lib/ai-visibility/run'
import { CITATION_PROMPTS } from '@/lib/ai-visibility/prompts'
import { PROVIDERS } from '@/lib/ai-visibility/providers'
import { isDataKey } from '@/lib/ai-visibility/prompts-data'
import { classifyTrafficSource, trafficSourceGroup } from '@/lib/marketing/classify-traffic-source'
import { CITATION_GROUP_LABEL, DIRECTORY_LISTINGS, MCP_TOOL_EVENT, citationShare, type CitationGroup } from '@/lib/mcp/tracking'
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

  const [crawlers, topPaths, runs, referrals, toolCalls] = await Promise.all([
    prisma.aiCrawlerHit.groupBy({ by: ['bot', 'vendor', 'purpose'], where: { day: { gte: since } }, _sum: { hits: true }, _count: { path: true }, orderBy: { _sum: { hits: 'desc' } } }),
    prisma.aiCrawlerHit.groupBy({ by: ['path'], where: { day: { gte: since }, purpose: { in: ['SEARCH', 'USER_FETCH'] } }, _sum: { hits: true }, orderBy: { _sum: { hits: 'desc' } }, take: 15 }),
    prisma.aiCitationRun.findMany({ orderBy: { startedAt: 'desc' }, take: 6, include: { results: { select: { provider: true, promptKey: true, cited: true, mentioned: true, error: true } } } }),
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
    prisma.$queryRaw<{ day: Date; tool: string; calls: number }[]>`SELECT date_trunc('day', "createdAt")::date AS day, properties->>'tool' AS tool, count(*)::int AS calls FROM "AnalyticsEvent" WHERE event = ${MCP_TOOL_EVENT} AND "createdAt" >= ${since} GROUP BY 1, 2 ORDER BY 1 DESC, 2`.catch(() => []),
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

  const callsByTool = new Map<string, number>()
  for (const c of toolCalls) callsByTool.set(c.tool, (callsByTool.get(c.tool) ?? 0) + c.calls)
  const lastDay = toolCalls[0]?.day
  const share = citationShare(runs.slice(0, 4).flatMap((r) => r.results))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">AI assistants</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visits that came from ChatGPT, Claude, Perplexity, Gemini and others, which AI crawlers read the site, and whether the assistants cite {OUR_DOMAIN}. Last 30 days.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-medium">MCP server: the three numbers</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tool calls by assistants in the last 30 days (one event per call, never the résumé text), where each directory listing stands, and how often assistants cite us on job search, career and résumé questions (last four weekly runs).</p>
        <h3 className="mt-3 text-sm font-medium">1. Tool calls</h3>
        {callsByTool.size === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No tool calls recorded yet.</p>
        ) : (
          <table className="mt-1 w-full max-w-xl text-sm">
            <thead><tr className="text-left"><th>Tool</th><th>Last 30 days</th><th>Per day</th></tr></thead>
            <tbody>
              {[...callsByTool.entries()].sort((a, b) => b[1] - a[1]).map(([tool, n]) => (
                <tr key={tool}><td>{tool}</td><td>{n}</td><td>{(n / 30).toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {lastDay && <p className="mt-1 text-xs text-muted-foreground">Latest call day: {lastDay.toISOString().slice(0, 10)}</p>}
        <h3 className="mt-3 text-sm font-medium">2. Directory listings</h3>
        <ul className="mt-1 text-sm">
          {DIRECTORY_LISTINGS.map((d) => (<li key={d.name}>{d.name}: {d.status.replace('_', ' ')} ({d.where})</li>))}
        </ul>
        <h3 className="mt-3 text-sm font-medium">3. Citation share</h3>
        <ul className="mt-1 text-sm">
          {(Object.keys(share) as CitationGroup[]).map((g) => (<li key={g}>{CITATION_GROUP_LABEL[g]}: {share[g].cited} cited of {share[g].asked} asked</li>))}
        </ul>
      </section>

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
          Each week: this week’s questions about the newest filings (where we should be cited) and a rotating 20 of the {CITATION_PROMPTS.length} general advice questions, asked of each assistant with web search on. Providers live: {enabled.length ? enabled.join(', ') : 'none'}. Estimated spend this month ${Number(spent._sum.estCostUsd ?? 0).toFixed(2)} of ${monthlyCapUsd()} cap. Add PERPLEXITY_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY to switch on more assistants.
        </p>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No run yet.</p>
        ) : (
          <table className="mt-2 w-full max-w-4xl text-sm">
            <thead><tr className="text-left"><th>Run</th><th>Assistant</th><th>Data questions: cited / asked</th><th>General questions: cited / asked</th><th>We were named</th><th>Errors</th></tr></thead>
            <tbody>
              {runs.flatMap((run) => {
                const by = new Map<string, { dataN: number; dataCited: number; genN: number; genCited: number; named: number; err: number }>()
                for (const r of run.results) {
                  const row = by.get(r.provider) ?? { dataN: 0, dataCited: 0, genN: 0, genCited: 0, named: 0, err: 0 }
                  if (r.error) row.err++
                  else if (isDataKey(r.promptKey)) { row.dataN++; if (r.cited) row.dataCited++ }
                  else { row.genN++; if (r.cited) row.genCited++ }
                  if (r.mentioned) row.named++
                  by.set(r.provider, row)
                }
                return [...by.entries()].map(([prov, r]) => (
                  <tr key={`${run.id}-${prov}`}><td>{run.startedAt.toISOString().slice(0, 10)}</td><td>{prov}</td><td>{r.dataCited} / {r.dataN}</td><td>{r.genCited} / {r.genN}</td><td>{r.named}</td><td>{r.err}</td></tr>
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
