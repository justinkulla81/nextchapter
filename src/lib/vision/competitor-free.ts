import 'server-only'
import { prisma } from '@/lib/prisma'
import { PoliteFetcher } from '@/lib/bids/polite-fetch'
import type { ProductCompetitor } from '@prisma/client'
import { getWatchSettings, runWatch, saveEvents, type WatchRunResult } from './competitor-watch'
import { pickDue, type CleanEvent } from './competitor-watch-core'
import { compareSite, eventsFromFeed, extractLogos, hashLines, htmlToLines, newLogos, newsFeedUrl, parseRss, usefulLinks } from './competitor-free-core'

/**
 * Free mode: no model, no paid search. News comes from a public Google News RSS feed and is sorted by keyword;
 * websites are re-read politely (one request at a time, robots.txt honoured) and compared with the last read.
 * Wins come from the award finder's own table. Anything this cannot decide is left for a person, not guessed.
 */
const FEED_GAP_MS = 2500
const SITE_TEXT_CAP = 40_000
const UA = 'NextChapterCompetitorWatch/1.0 (+https://launchyournextchapter.com; reads public news headlines and websites monthly)'
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** One request at a time, a gap between requests, and a 403/429/503 ends the run for the feed. */
class FeedFetcher {
  private last = 0
  private queue: Promise<unknown> = Promise.resolve()
  blocked = false
  requests = 0
  get(url: string): Promise<string | null> {
    const run = this.queue.then(async () => {
      if (this.blocked) return null
      const wait = this.last + FEED_GAP_MS - Date.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      this.last = Date.now()
      this.requests++
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(12_000) })
        if ([403, 429, 503].includes(res.status)) { this.blocked = true; return null }
        if (!res.ok) return null
        return (await res.text()).slice(0, 1_000_000)
      } catch { return null }
    })
    this.queue = run.catch(() => undefined)
    return run
  }
}

/** Awards the bid finder has already found for competitor cards (EXACT matches only). No lookup of our own. */
export async function awardEventsFor(cards: Pick<ProductCompetitor, 'id' | 'name'>[], now: Date): Promise<Map<string, CleanEvent[]>> {
  const rows = await prisma.competitorAward.findMany({ where: { confidence: 'EXACT', firstSeenAt: { gte: new Date(now.getTime() - 150 * 86_400_000) } }, take: 5000 })
  const byName = new Map(cards.map((c) => [norm(c.name), c.id]))
  const byId = new Set(cards.map((c) => c.id))
  const out = new Map<string, CleanEvent[]>()
  for (const a of rows) {
    const id = a.competitorId && byId.has(a.competitorId) ? a.competitorId : byName.get(norm(a.competitorName))
    if (!id) continue
    const what = (a.description ?? 'Award').replace(/\s+/g, ' ').slice(0, 140)
    const ev: CleanEvent = {
      kind: 'WIN', title: `${what}${a.agency ? ` (${a.agency})` : ''}`.slice(0, 200),
      summary: `${a.kind} · $${Math.round(a.amount).toLocaleString('en-US')} · from the award finder (USAspending.gov)`, url: a.url, amountUsd: a.amount,
      occurredAt: a.startDate, dedupeKey: `WIN:award:${a.awardKey}`,
    }
    out.set(id, [...(out.get(id) ?? []), ev])
  }
  return out
}

async function freeNews(cards: ProductCompetitor[], now: Date, batch: number, stopAt: number): Promise<WatchRunResult> {
  const res: WatchRunResult = { kind: 'news', processed: 0, failed: 0, events: 0, proposals: 0, costUsd: 0, spentMonth: 0 }
  // Wins first: a single read of our own table, for every active card, whether or not its news is due.
  const awards = await awardEventsFor(cards.filter((c) => c.status === 'ACTIVE'), now)
  for (const [id, evs] of awards) res.events += await saveEvents(id, evs, 'database')
  const feed = new FeedFetcher()
  for (const d of pickDue(cards, 'news', now, batch)) {
    if (Date.now() > stopAt) break
    if (feed.blocked) { res.skipped = 'news feed asked us to slow down; stopped for today'; break }
    const c = cards.find((x) => x.id === d.id)!
    const xml = await feed.get(newsFeedUrl(c.name))
    if (xml === null) { res.failed++; if (!feed.blocked) await prisma.productCompetitor.update({ where: { id: c.id }, data: { watchNewsAt: now } }); continue }
    const events = eventsFromFeed(parseRss(xml), c.name, now)
    res.events += await saveEvents(c.id, events, 'news')
    const gone = events.find((e) => e.kind === 'CLOSURE')
    await prisma.productCompetitor.update({ where: { id: c.id }, data: { watchNewsAt: now, ...(gone && c.status === 'ACTIVE' ? { needsReview: true } : {}) } })
    res.processed++
  }
  return res
}

async function freeRefreshCard(c: ProductCompetitor, fetcher: PoliteFetcher, now: Date): Promise<number> {
  const home = await fetcher.get(c.url!)
  if (!home.ok) throw new Error(`site not readable (${home.reason})`)
  const pages = [{ url: home.url, html: home.html }]
  for (const link of usefulLinks(home.html, home.url)) {
    const r = await fetcher.get(link)
    if (r.ok) pages.push({ url: r.url, html: r.html })
  }
  const lines = [...new Set(pages.flatMap((p) => htmlToLines(p.html)))]
  const logos = [...new Set(pages.flatMap((p) => extractLogos(p.html, c.name)))]
  const hash = hashLines(lines)
  const first = !c.siteReadAt
  let events = 0
  if (!first && hash !== c.siteHash) {
    const change = compareSite(c.siteText ? c.siteText.split('\n') : null, lines)
    const ev: CleanEvent[] = []
    if (change.changed) {
      ev.push({ kind: 'SITE_CHANGE', title: `Website changed: ${change.added.length} new lines`, summary: change.added.slice(0, 5).map((l) => `• ${l.slice(0, 140)}`).join('\n'), url: home.url, amountUsd: null, occurredAt: null, dedupeKey: `SITE_CHANGE:${hash}` })
    }
    for (const name of newLogos(c.siteLogos, logos).slice(0, 10)) {
      ev.push({ kind: 'LOGO', title: `Possible new customer logo on their site: ${name}`, summary: 'Found by comparing logo names between reads; check it is a customer.', url: home.url, amountUsd: null, occurredAt: null, dedupeKey: `LOGO:${norm(name)}` })
    }
    events = await saveEvents(c.id, ev, 'site')
    if (change.changed) await prisma.productCompetitor.update({ where: { id: c.id }, data: { needsReview: true } })
  }
  await prisma.productCompetitor.update({
    where: { id: c.id },
    data: { siteText: lines.join('\n').slice(0, SITE_TEXT_CAP), siteHash: hash, siteLogos: logos, siteReadAt: now, watchRefreshedAt: now },
  })
  return events
}

async function freeRefresh(cards: ProductCompetitor[], now: Date, batch: number, stopAt: number): Promise<WatchRunResult> {
  const res: WatchRunResult = { kind: 'refresh', processed: 0, failed: 0, events: 0, proposals: 0, costUsd: 0, spentMonth: 0 }
  const fetcher = new PoliteFetcher(2000)
  for (const d of pickDue(cards, 'refresh', now, batch)) {
    if (Date.now() > stopAt) break
    const c = cards.find((x) => x.id === d.id)!
    try {
      res.events += await freeRefreshCard(c, fetcher, now)
      res.processed++
    } catch {
      res.failed++
      await prisma.productCompetitor.update({ where: { id: c.id }, data: { watchRefreshedAt: now } }) // do not retry a broken site every run
    }
  }
  return res
}

/** What the cron route calls: free by default, the paid model path only when the setting says PAID. */
export async function runWatchByMode(kind: 'refresh' | 'news'): Promise<WatchRunResult & { mode: string }> {
  const s = await getWatchSettings()
  if (s.mode === 'PAID') return { ...(await runWatch(kind, { batch: kind === 'news' ? 25 : 20 })), mode: 'PAID' }
  const now = new Date()
  const base: WatchRunResult = { kind, processed: 0, failed: 0, events: 0, proposals: 0, costUsd: 0, spentMonth: 0 }
  if (!s.enabled) return { ...base, skipped: 'watch is off', mode: 'FREE' }
  if ((kind === 'refresh' && !s.refreshEnabled) || (kind === 'news' && !s.newsEnabled)) return { ...base, skipped: `${kind} is off`, mode: 'FREE' }
  const cards = await prisma.productCompetitor.findMany()
  const stopAt = Date.now() + 240_000
  const r = kind === 'news' ? await freeNews(cards, now, 60, stopAt) : await freeRefresh(cards, now, 40, stopAt)
  await prisma.competitorWatchRun.create({ data: { kind: `free-${kind}`, costUsd: 0, searches: 0, ok: r.failed === 0 || r.processed > 0, error: r.skipped ?? null } })
  return { ...r, mode: 'FREE' }
}
