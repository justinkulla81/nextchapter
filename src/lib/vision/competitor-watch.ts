import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { enrichCompetitor, type EnrichedCompetitor } from './competitor-enrich'
import type { NamedEntry, WinEntry } from './competitor-areas'
import {
  EST_COST, cleanEvents, cleanProposals, eventsFromDiff, fitsCap, monthStart, pickDue, unionNamed, unionStrings, type CleanEvent,
} from './competitor-watch-core'
import type { ProductCompetitor } from '@prisma/client'

/** Haiku 4.5: the cheapest model that reads pages and searches well enough for this. $1 / $5 per million tokens, search $10 per 1,000. */
const NEWS_MODEL = 'claude-haiku-4-5-20251001'
const PRICE = { inPerM: 1, outPerM: 5, perSearch: 0.01 }

export async function getWatchSettings() {
  return prisma.competitorWatchSetting.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} })
}

export async function spentThisMonth(now = new Date()): Promise<number> {
  const r = await prisma.competitorWatchRun.aggregate({ where: { createdAt: { gte: monthStart(now) } }, _sum: { costUsd: true } })
  return r._sum.costUsd ?? 0
}

/** The card update a refresh makes. It only adds: lists are unioned, blanks are filled, nothing is cleared. */
export function mergeRefresh(c: ProductCompetitor, e: EnrichedCompetitor) {
  const customers = unionNamed((c.customers as NamedEntry[] | null) ?? [], e.customers, 60)
  const wins = unionNamed((c.wins as WinEntry[] | null) ?? [], e.wins, 60)
  const fund = e.fundingRaisedUsd && e.fundingRaisedUsd <= 2_147_483_647 ? e.fundingRaisedUsd : null
  return {
    positioning: c.positioning ?? e.positioning, segment: c.segment ?? e.segment,
    areas: unionStrings(c.areas, e.areas, 18), keyFeatures: unionStrings(c.keyFeatures, e.keyFeatures, 20),
    customers: customers as unknown as object, wins: wins as unknown as object,
    weWin: unionStrings(c.weWin, e.weWin, 8), theyWin: unionStrings(c.theyWin, e.theyWin, 8), weNeed: unionStrings(c.weNeed, e.weNeed, 8),
    pricingNote: e.pricingNote ?? c.pricingNote, foundedYear: c.foundedYear ?? e.foundedYear, hq: c.hq ?? e.hq,
    lastRound: e.lastRound ?? c.lastRound, investors: e.investors ?? c.investors,
    fundingRaisedUsd: fund ?? c.fundingRaisedUsd, headcount: e.headcount ?? c.headcount,
    revenueNote: e.revenueNote ?? c.revenueNote, userCountNote: e.userCountNote ?? c.userCountNote,
    sourceUrl: e.sourceUrl ?? c.sourceUrl, notes: c.notes ?? e.notes,
    relationship: c.filledBy === 'hand' ? c.relationship : e.relationship,
    status: e.status !== 'ACTIVE' ? e.status : c.status, statusNote: e.statusNote ?? c.statusNote,
    lessons: unionStrings(c.lessons, e.lessons, 8), partnerIdea: c.partnerIdea ?? e.partnerIdea,
    needsReview: true, lastReviewedAt: new Date(), filledBy: c.filledBy ?? 'website',
  }
}

async function saveEvents(competitorId: string, events: CleanEvent[], source: string): Promise<number> {
  if (events.length === 0) return 0
  const r = await prisma.competitorEvent.createMany({
    data: events.map((e) => ({ competitorId, kind: e.kind, title: e.title, summary: e.summary, url: e.url, amountUsd: e.amountUsd, occurredAt: e.occurredAt, source, dedupeKey: e.dedupeKey })),
    skipDuplicates: true,
  })
  return r.count
}

/**
 * Wins already in our own data. Reads FederalContractSummary (USAspending totals per directory company) by exact
 * normalized name; the bid-finding work adds richer award tables later and should be read here the same way,
 * not re-fetched. No model or search cost.
 */
export async function winsFromOurData(c: Pick<ProductCompetitor, 'id' | 'name'>): Promise<CleanEvent[]> {
  const co = await prisma.company.findUnique({ where: { canonicalNameNormalized: normalizeOrgName(c.name) }, select: { id: true } })
  if (!co) return []
  const s = await prisma.federalContractSummary.findUnique({ where: { companyId: co.id } })
  if (!s || s.awards <= 0) return []
  return [{
    kind: 'WIN', title: `${s.awards} federal contract award${s.awards === 1 ? '' : 's'} in the last two years`,
    summary: `${s.topAgency ? `Top agency: ${s.topAgency}. ` : ''}Source: USAspending.gov, checked ${s.checkedAt.toISOString().slice(0, 10)}.`,
    url: 'https://www.usaspending.gov/', amountUsd: s.totalAmount, occurredAt: null, dedupeKey: `WIN:fedsummary:${s.awards}:${Math.round(s.totalAmount)}`,
  }]
}

async function record(competitorId: string | null, kind: 'refresh' | 'news', costUsd: number, searches: number, error?: string) {
  await prisma.competitorWatchRun.create({ data: { competitorId, kind, costUsd, searches, ok: !error, error: error?.slice(0, 300) } })
}

/** Monthly refresh of one card: re-reads the site, adds to the card, records new logos/wins/funding/status events and proposes matrix cells. */
export async function refreshCard(c: ProductCompetitor): Promise<{ events: number; proposals: number; cost: number }> {
  const caps = await prisma.productCapability.findMany({ select: { id: true, key: true, name: true, description: true } })
  let cost = 0, searches = 0
  try {
    const r = await enrichCompetitor(c.url!, c.positioning ?? undefined, { capabilities: caps })
    cost = r.cost; searches = r.searches
    const before = { customers: (c.customers as NamedEntry[] | null) ?? [], wins: (c.wins as WinEntry[] | null) ?? [], lastRound: c.lastRound, status: c.status }
    const data = mergeRefresh(c, r.data)
    await prisma.productCompetitor.update({ where: { id: c.id }, data: { ...data, watchRefreshedAt: new Date() } })
    const events = eventsFromDiff(before, {
      customers: data.customers as unknown as NamedEntry[], wins: data.wins as unknown as WinEntry[],
      lastRound: data.lastRound, status: data.status, statusNote: data.statusNote, sourceUrl: data.sourceUrl,
    })
    // Skip the very first read of a card that had no customers or wins: those are the card being filled, not news.
    const fresh = before.customers.length + before.wins.length === 0 ? events.filter((e) => e.kind !== 'LOGO' && e.kind !== 'WIN') : events
    const nEvents = await saveEvents(c.id, [...fresh, ...(await winsFromOurData(c))], 'site')

    const byKey = new Map(caps.map((k) => [k.key, k.id]))
    const props = cleanProposals(r.data.capabilityProposals, new Set(byKey.keys()))
    // Only propose where the matrix has no answer yet or the answer differs; confirmed cells are never touched.
    const existing = await prisma.competitorCapability.findMany({ where: { competitorId: c.id }, select: { capabilityId: true, status: true } })
    const have = new Map(existing.map((x) => [x.capabilityId, x.status]))
    let nProps = 0
    for (const p of props) {
      const capabilityId = byKey.get(p.key)!
      if (have.get(capabilityId) === p.status) continue
      await prisma.competitorCellProposal.deleteMany({ where: { competitorId: c.id, capabilityId, state: 'PENDING' } })
      await prisma.competitorCellProposal.create({ data: { competitorId: c.id, capabilityId, status: p.status, evidenceUrl: p.evidenceUrl, note: p.note } })
      nProps++
    }
    await record(c.id, 'refresh', cost, searches)
    return { events: nEvents, proposals: nProps, cost }
  } catch (e) {
    await record(c.id, 'refresh', cost, searches, e instanceof Error ? e.message : String(e))
    await prisma.productCompetitor.update({ where: { id: c.id }, data: { watchRefreshedAt: new Date() } }) // do not retry the same broken site every run
    throw e
  }
}

/** Weekly news read for one card: up to 2 searches, last ~10 days, returns only sourced items. */
export async function newsForCard(c: ProductCompetitor, now = new Date()): Promise<{ events: number; cost: number }> {
  const prompt = `Find news from the last 10 days (today is ${now.toISOString().slice(0, 10)}) about the company "${c.name}" (${c.url}). Use at most 2 web searches. Report only things a competitor should notice:
- funding rounds, acquisitions or mergers (kind FUNDING or ACQUISITION),
- layoffs, restructuring, leadership exits, or going out of business (LAYOFF or CLOSURE),
- government grants, contracts or RFPs they won (WIN),
- new named customers or partners (LOGO),
- major product launches or pricing changes (NEWS).
Return ONE JSON array in a json code block: [{"kind","title","summary":"one or two sentences","url":"article link","date":"YYYY-MM-DD","amountUsd":number or null}]. Every item MUST have the article's real https link. Return [] if there is nothing; never guess or pad.`
  const client = getAnthropicClient()
  let cost = 0, searches = 0
  try {
    const r = await (client.messages.create as unknown as (a: unknown) => Promise<{ usage: { input_tokens: number; output_tokens: number; server_tool_use?: { web_search_requests?: number } }; content: { type: string; text?: string }[] }>)({
      model: NEWS_MODEL, max_tokens: 1500, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }], messages: [{ role: 'user', content: prompt }],
    })
    searches = r.usage.server_tool_use?.web_search_requests ?? 0
    cost = (r.usage.input_tokens * PRICE.inPerM + r.usage.output_tokens * PRICE.outPerM) / 1e6 + searches * PRICE.perSearch
    const text = r.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    let raw: unknown = []
    try { raw = JSON.parse((m ? m[1] : text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)).trim()) } catch { raw = [] }
    const events = cleanEvents(raw, now, 45)
    const n = await saveEvents(c.id, events, 'news')
    // Layoffs/closure reported in the news also mark the card, so the status stays honest. Adds a note; never overwrites a hand-written one.
    const gone = events.find((e) => e.kind === 'CLOSURE')
    await prisma.productCompetitor.update({ where: { id: c.id }, data: { watchNewsAt: now, ...(gone && c.status === 'ACTIVE' ? { needsReview: true, notes: [c.notes, `News ${now.toISOString().slice(0, 10)}: ${gone.title} (${gone.url})`].filter(Boolean).join('\n') } : {}) } })
    await record(c.id, 'news', cost, searches)
    return { events: n, cost }
  } catch (e) {
    await record(c.id, 'news', cost, searches, e instanceof Error ? e.message : String(e))
    await prisma.productCompetitor.update({ where: { id: c.id }, data: { watchNewsAt: now } })
    throw e
  }
}

export interface WatchRunResult { kind: string; skipped?: string; processed: number; failed: number; events: number; proposals: number; costUsd: number; spentMonth: number }

/** One batch for a cron run. Does nothing unless the master switch is on; stops the moment the monthly cap would be crossed. */
export async function runWatch(kind: 'refresh' | 'news', opts: { batch?: number; deadlineMs?: number } = {}): Promise<WatchRunResult> {
  const now = new Date()
  const s = await getWatchSettings()
  const base = { kind, processed: 0, failed: 0, events: 0, proposals: 0, costUsd: 0 }
  let spent = await spentThisMonth(now)
  if (!s.enabled) return { ...base, skipped: 'watch is off', spentMonth: spent }
  if ((kind === 'refresh' && !s.refreshEnabled) || (kind === 'news' && !s.newsEnabled)) return { ...base, skipped: `${kind} is off`, spentMonth: spent }
  const cards = await prisma.productCompetitor.findMany()
  const due = pickDue(cards, kind, now, opts.batch ?? 20)
  const byId = new Map(cards.map((c) => [c.id, c]))
  const stopAt = Date.now() + (opts.deadlineMs ?? 240_000)
  const res: WatchRunResult = { ...base, spentMonth: spent }
  for (const d of due) {
    if (Date.now() > stopAt) break
    if (!fitsCap(spent, s.monthlyCapUsd, kind)) { res.skipped = 'monthly cap reached'; break }
    try {
      const r = kind === 'refresh' ? await refreshCard(byId.get(d.id)!) : await newsForCard(byId.get(d.id)!, now)
      res.processed++; res.events += r.events; res.costUsd += r.cost; spent += r.cost
      res.proposals += 'proposals' in r ? Number(r.proposals) : 0
    } catch { res.failed++; spent += EST_COST[kind] / 2 }
  }
  res.spentMonth = spent
  return res
}
