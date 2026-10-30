/**
 * Where each competitor shows up (conference booths, sponsorships, speaking, podcasts), plus funding and pricing where the card has none.
 *
 *   npx tsx --env-file=.env.local scripts/vision/sweep-competitor-presence.ts --db                free: match competitors to the conference catalog we already hold
 *   npx tsx --env-file=.env.local scripts/vision/sweep-competitor-presence.ts --web --limit 6     metered web read, DIRECT and ADJACENT cards first
 *   npx tsx --env-file=.env.local scripts/vision/sweep-competitor-presence.ts --web               every active DIRECT and ADJACENT card
 *   add --rel DIRECT,ADJACENT,PARTNER to change which relationships are read, --dry to print without writing
 *
 * Metered: Claude Haiku with up to 4 web searches per company (about $0.08). Every call goes to data/geo/research/cost-ledger.jsonl and the
 * run stops at CAP dollars for the step "competitor-presence". Each link the model returns is fetched once and dropped if the page is gone (404/410/DNS);
 * an item without a working link is never filed. Presence events are filed as already digested, so the daily digest does not repeat them.
 * Funding and pricing only fill an empty card; an existing figure is never overwritten.
 */
import { PrismaClient } from '@prisma/client'
import { ask, jsonOf, pool, spent } from '../geo/_llm'
import { cleanUrl, hostOf, parseUsd } from '../../src/lib/vision/competitor-areas'

const prisma = new PrismaClient()
const STEP = 'competitor-presence'
const CAP = 22
const DRY = process.argv.includes('--dry')
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null }
const limit = Number(arg('--limit') ?? Infinity)
const rels = (arg('--rel') ?? 'DIRECT,ADJACENT').split(',')
const NOW = new Date()
const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(inc|llc|ltd|corp|corporation|co|company|the)\b\.?/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

type Ev = { competitorId: string; kind: 'BOOTH' | 'SPONSOR' | 'SPEAKING' | 'PODCAST'; title: string; summary: string | null; url: string | null; occurredAt: Date | null; source: string; dedupeKey: string }

async function save(events: Ev[]) {
  if (DRY || events.length === 0) return
  await prisma.competitorEvent.createMany({ data: events.map((e) => ({ ...e, digestedAt: NOW })), skipDuplicates: true })
}

async function fromCatalog() {
  const comps = await prisma.productCompetitor.findMany({ select: { id: true, name: true } })
  const byName = new Map<string, string>()
  for (const c of comps) { const k = norm(c.name); if (k.length >= 4) byName.set(k, c.id) }
  const out: Ev[] = []
  const emp = await prisma.conferenceEmployer.findMany({ select: { name: true, role: true, year: true, sourceUrl: true, series: { select: { id: true, name: true, url: true } } } })
  for (const e of emp) {
    const id = byName.get(norm(e.name)); if (!id || e.role === 'ATTENDEE') continue
    const kind = e.role === 'SPONSOR' ? 'SPONSOR' : e.role === 'SPEAKER' ? 'SPEAKING' : 'BOOTH'
    out.push({ competitorId: id, kind, title: `${e.series.name}${e.year ? ` ${e.year}` : ''}`, summary: null, url: e.sourceUrl ?? e.series.url, occurredAt: e.year ? new Date(Date.UTC(e.year, 5, 1)) : null, source: 'database', dedupeKey: `conf:${e.series.id}:${kind}:${e.year ?? ''}` })
  }
  const spk = await prisma.conferenceSpeaker.findMany({ select: { name: true, title: true, organization: true, year: true, sourceUrl: true, sessionTitle: true, series: { select: { id: true, name: true } } } })
  for (const s of spk) {
    const id = s.organization ? byName.get(norm(s.organization)) : null; if (!id) continue
    out.push({ competitorId: id, kind: 'SPEAKING', title: `${s.series.name}${s.year ? ` ${s.year}` : ''}`, summary: [s.name, s.title, s.sessionTitle].filter(Boolean).join(', '), url: s.sourceUrl, occurredAt: s.year ? new Date(Date.UTC(s.year, 5, 1)) : null, source: 'database', dedupeKey: `spk:${s.series.id}:${s.year ?? ''}:${norm(s.name)}` })
  }
  console.log(`catalog match: ${out.length} rows for ${new Set(out.map((o) => o.competitorId)).size} competitors (${out.filter((o) => o.kind === 'BOOTH').length} booths, ${out.filter((o) => o.kind === 'SPONSOR').length} sponsors, ${out.filter((o) => o.kind === 'SPEAKING').length} speaking)`)
  await save(out)
}

/** A link counts unless the page is gone. A bot block (403, 405, 429) is not evidence the page is missing. */
async function alive(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; NextChapterResearch/1.0)' } })
    return r.status !== 404 && r.status !== 410 && r.status < 500
  } catch { return false }
}

interface Reply {
  appearances?: { kind?: string; event?: string; year?: number; url?: string; detail?: string }[]
  podcasts?: { show?: string; title?: string; year?: number; url?: string; role?: string }[]
  funding?: { raisedUsd?: number | string | null; lastRound?: string | null; investors?: string | null; url?: string | null } | null
  pricing?: { note?: string | null; url?: string | null } | null
}

async function web() {
  const cards = (await prisma.productCompetitor.findMany({ where: { status: 'ACTIVE', relationship: { in: rels }, url: { not: null } }, select: { id: true, name: true, url: true, fundingRaisedUsd: true, lastRound: true, investors: true, pricingNote: true }, orderBy: { name: 'asc' } })).slice(0, limit)
  console.log(`${cards.length} cards; spent on this step $${spent(STEP).toFixed(2)} of $${CAP}`)
  const tally = { booth: 0, sponsor: 0, speaking: 0, podcast: 0, funding: 0, pricing: 0, droppedLinks: 0, errors: 0 }
  let run = 0
  await pool(cards, 4, async (c, i) => {
    try {
      const host = hostOf(c.url!) ?? c.url!
      const { text, cost } = await ask(STEP, CAP,
        `Research ${c.name} (${host}), a company in the job-search, career-transition, workforce, hiring or HR-tech market. Use web search. Find:\n` +
        `1. Industry conferences, trade shows and summits where it exhibited at a booth, sponsored, or had a speaker, in the last 24 months or announced for 2026-2027.\n` +
        `2. Podcast episodes where its people appeared as guests or hosts, or that it sponsors.\n` +
        `3. ${c.fundingRaisedUsd || c.lastRound ? 'Skip funding.' : 'Total funding raised, last round, investors.'}\n` +
        `4. ${c.pricingNote ? 'Skip pricing.' : 'Public pricing: plans and prices, or "contact sales".'}\n` +
        `Reply with ONLY JSON: {"appearances":[{"kind":"BOOTH|SPONSOR|SPEAKING","event":"event name","year":2026,"url":"page that shows it","detail":"speaker name and topic, if speaking"}],"podcasts":[{"show":"","title":"episode title","year":2026,"url":"","role":"GUEST|HOST|SPONSOR"}],"funding":{"raisedUsd":number|null,"lastRound":"e.g. $24M Series B, 2025","investors":"","url":""}|null,"pricing":{"note":"one line with the real prices","url":""}|null}\n` +
        `Rules: every item needs a url of a page you actually found; no guessing; at most 8 appearances and 5 podcasts; empty arrays and null when nothing is found.`,
        { searches: 4, maxTokens: 1800 })
      const r = jsonOf<Reply>(text) ?? {}
      const evs: Ev[] = []
      const keep = async (u: unknown) => { const url = cleanUrl(u); if (!url) return null; if (await alive(url)) return url; tally.droppedLinks++; return null }
      for (const a of (r.appearances ?? []).slice(0, 8)) {
        const kind = String(a.kind ?? '').toUpperCase(); if (!['BOOTH', 'SPONSOR', 'SPEAKING'].includes(kind) || !a.event) continue
        const url = await keep(a.url); if (!url) continue
        const y = typeof a.year === 'number' && a.year > 2022 && a.year < 2030 ? a.year : null
        evs.push({ competitorId: c.id, kind: kind as Ev['kind'], title: `${a.event}${y ? ` ${y}` : ''}`.slice(0, 200), summary: a.detail ? String(a.detail).slice(0, 300) : null, url, occurredAt: y ? new Date(Date.UTC(y, 5, 1)) : null, source: 'web', dedupeKey: `web:${kind}:${hostOf(url) ?? ''}${new URL(url).pathname}`.toLowerCase().slice(0, 240) })
      }
      for (const p of (r.podcasts ?? []).slice(0, 5)) {
        if (!p.show) continue
        const url = await keep(p.url); if (!url) continue
        const y = typeof p.year === 'number' && p.year > 2022 && p.year < 2030 ? p.year : null
        evs.push({ competitorId: c.id, kind: 'PODCAST', title: `${p.show}${p.title ? `: ${p.title}` : ''}`.slice(0, 200), summary: p.role ? String(p.role).toLowerCase() : null, url, occurredAt: y ? new Date(Date.UTC(y, 5, 1)) : null, source: 'web', dedupeKey: `web:PODCAST:${hostOf(url) ?? ''}${new URL(url).pathname}`.toLowerCase().slice(0, 240) })
      }
      tally.booth += evs.filter((e) => e.kind === 'BOOTH').length; tally.sponsor += evs.filter((e) => e.kind === 'SPONSOR').length; tally.speaking += evs.filter((e) => e.kind === 'SPEAKING').length; tally.podcast += evs.filter((e) => e.kind === 'PODCAST').length
      await save(evs)

      const data: Record<string, unknown> = {}
      const f = r.funding
      if (f && !c.fundingRaisedUsd && !c.lastRound && (f.raisedUsd || f.lastRound) && f.url && await alive(String(f.url))) {
        const usd = parseUsd(f.raisedUsd ?? '')
        if (usd && usd <= 2_147_483_647) data.fundingRaisedUsd = usd
        if (f.lastRound) data.lastRound = String(f.lastRound).slice(0, 160)
        if (f.investors && !c.investors) data.investors = String(f.investors).slice(0, 200)
        if (Object.keys(data).length) tally.funding++
      }
      const pr = r.pricing
      if (pr?.note && !c.pricingNote && pr.url && await alive(String(pr.url))) { data.pricingNote = `${String(pr.note).slice(0, 180)} (read 2026-10-30)`; tally.pricing++ }
      if (!DRY && Object.keys(data).length) await prisma.productCompetitor.update({ where: { id: c.id }, data })
      run += cost
      console.log(`${c.name}: ${evs.length} presence items${data.fundingRaisedUsd || data.lastRound ? ', funding' : ''}${data.pricingNote ? ', pricing' : ''}  $${cost.toFixed(3)}`)
    } catch (e) { tally.errors++; console.log(`! ${c.name}: ${(e as Error).message.slice(0, 120)}`) }
    if ((i + 1) % 25 === 0) console.log(`  --- ${i + 1}/${cards.length} spent $${run.toFixed(2)} ${JSON.stringify(tally)}`)
  })
  console.log(`done: ${JSON.stringify(tally)}; this run $${run.toFixed(2)}, step total $${spent(STEP).toFixed(2)}`)
}

async function main() {
  if (process.argv.includes('--db')) await fromCatalog()
  if (process.argv.includes('--web')) await web()
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
