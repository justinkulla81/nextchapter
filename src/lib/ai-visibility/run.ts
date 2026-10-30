import 'server-only'
import { prisma } from '@/lib/prisma'
import { CITATION_PROMPTS } from './prompts'
import { PROVIDERS } from './providers'

export const OUR_DOMAIN = 'launchyournextchapter.com'
const BRAND = /nextchapter|launchyournextchapter|launch your next chapter/i
// Each provider has its own pool and the providers run side by side: one run is about 30 questions x 4 providers, and one provider
// after another took longer than the 300 s a cron may run (the first manual run was still going after 5 minutes).
const PER_PROVIDER = 3

/** Monthly spend ceiling on assistant lookups, in USD. Approved 2026-10-28 at $20. */
export function monthlyCapUsd(): number {
  const n = Number(process.env.AI_CITATION_MONTHLY_CAP_USD)
  return Number.isFinite(n) && n > 0 ? n : 20
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

async function spentThisMonth(): Promise<number> {
  const start = new Date()
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  const agg = await prisma.aiCitationResult.aggregate({ _sum: { estCostUsd: true }, where: { createdAt: { gte: start } } })
  return Number(agg._sum.estCostUsd ?? 0)
}

/**
 * One sweep: every tracked prompt on every provider that has a key, stopping the moment the month's estimated spend
 * would pass the cap. Results are stored one row per prompt and provider.
 */
export async function runCitationCheck(opts: { providerIds?: string[]; limit?: number } = {}) {
  const providers = PROVIDERS.filter((p) => p.enabled() && (!opts.providerIds || opts.providerIds.includes(p.id)))
  const prompts = CITATION_PROMPTS.slice(0, opts.limit ?? CITATION_PROMPTS.length)
  const run = await prisma.aiCitationRun.create({ data: {} })
  if (providers.length === 0) {
    await prisma.aiCitationRun.update({ where: { id: run.id }, data: { finishedAt: new Date() } })
    return { runId: run.id, providers: [] as string[], asked: 0, cited: 0, spentUsd: 0, skippedForCap: false }
  }

  const cap = monthlyCapUsd()
  let spent = await spentThisMonth()
  let runCost = 0
  let skippedForCap = false
  let asked = 0
  let cited = 0

  const queues = providers.map((p) => ({ p, next: 0 }))
  async function worker(queue: { p: (typeof providers)[number]; next: number }) {
    const { p } = queue
    while (queue.next < prompts.length) {
      const q = prompts[queue.next++]
      // Reserve the cost before the call so parallel workers cannot overshoot the cap together.
      if (spent + p.estCostUsd > cap) {
        skippedForCap = true
        return
      }
      spent += p.estCostUsd
      runCost += p.estCostUsd
      let data
      try {
        const a = await p.ask(q.prompt)
        // An empty answer is a failed call, not an answer that cites nobody (a reasoning model can spend its whole token budget thinking).
        if (!a.text.trim()) throw new Error('empty answer')
        const domains = [...new Set(a.sources.map(domainOf).filter((d): d is string => !!d))]
        const ourUrls = [...new Set(a.sources.filter((u) => domainOf(u) === OUR_DOMAIN || domainOf(u)?.endsWith(`.${OUR_DOMAIN}`)))]
        const isCited = ourUrls.length > 0
        if (isCited) cited++
        data = { cited: isCited, mentioned: BRAND.test(a.text), ourUrls, citedDomains: domains, snippet: a.text.slice(0, 400), error: null as string | null }
      } catch (e) {
        data = { cited: false, mentioned: false, ourUrls: [] as string[], citedDomains: [] as string[], snippet: null as string | null, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }
      }
      asked++
      await prisma.aiCitationResult.create({ data: { runId: run.id, provider: p.id, promptKey: q.key, prompt: q.prompt, estCostUsd: p.estCostUsd, ...data } })
    }
  }
  await Promise.all(queues.flatMap((queue) => Array.from({ length: PER_PROVIDER }, () => worker(queue))))

  await prisma.aiCitationRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), estCostUsd: runCost, skippedForCap } })
  return { runId: run.id, providers: providers.map((p) => p.id), asked, cited, spentUsd: Number(runCost.toFixed(4)), skippedForCap }
}
