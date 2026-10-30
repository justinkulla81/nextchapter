import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadExposureMap } from '@/lib/skills/ai-exposure-server'
import { employerSlug } from '@/lib/warn/layoff-pages'
import { credibilityOf, looksNonUs, plausibleEmployer, sameEvent, type Credibility, type EventRef } from '@/lib/linkedin/layoff-post-rules'
import type { AiMarketData } from '@/lib/skills/ai-market'
import occupations from '@/lib/ai-check/occupations.json'
import { buildVersions, campaignFor, type Card } from './card'
import { aiJobCard, aiPayCard, deadlineCard, entryCard, layoffCard, seniorCard } from './cards'

// The morning run: builds today's drafts from the data and saves them. Idempotent (a draft is unique per day, kind and
// subject), so a rerun only adds what is new. No model call and nothing is posted anywhere.

const DAY_MS = 86_400_000
/** At most this many layoff drafts a day; the deadline card is separate. */
const LAYOFFS_PER_DAY = 2
/** The same employer or occupation is not drafted again within this many days. */
const REPEAT_DAYS = 14
const AI_JOB_REPEAT_DAYS = 90
/** A data card whose number has not moved is not drafted again within this many days. */
const SAME_NUMBER_DAYS = 6
const CRED_RANK: Record<Credibility, number> = { 'warn-filing': 4, 'sec-filing': 3, 'two-publishers': 2, 'trusted-outlet': 1, unconfirmed: 0 }

export const easternDay = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

export interface GenerateResult { day: string; created: string[]; skipped: string[] }

interface LayoffCandidate { employer: string; employees: number; state: string | null; place: string | null; effectiveDate: Date | null; noticeDate: Date | null; credibility: Credibility; slug: string; sourceUrl: string | null }

/**
 * Recent layoffs that pass the same credibility gate as the LinkedIn queue (a state WARN filing, an SEC filing, or news
 * from two publishers or a trusted outlet; plausible employer; not speculation; US), biggest first, one per event.
 */
export async function loadLayoffCandidates(now: Date): Promise<LayoffCandidate[]> {
  const notices = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, employees: { gte: 50, lte: 40_000 }, fetchedAt: { gte: new Date(now.getTime() - 10 * DAY_MS) } },
    orderBy: { employees: 'desc' },
    take: 120,
  })
  if (!notices.length) return []
  const mentions = await prisma.layoffNewsMention.findMany({
    where: { noticeId: { in: notices.map((n) => n.id) } },
    select: { noticeId: true, publisher: true, headline: true },
  })
  const rows = notices.flatMap((n) => {
    const m = mentions.filter((x) => x.noticeId === n.id)
    const heads = m.map((x) => x.headline)
    const why = credibilityOf(n, m.map((x) => x.publisher), now, heads)
    if (!why || why === 'unconfirmed') return []
    // A filing re-fetched long after the fact is not news: its layoffs took effect already or it was filed weeks ago.
    if (n.effectiveDate && n.effectiveDate.getTime() < now.getTime() - 3 * DAY_MS) return []
    if (n.noticeDate && n.noticeDate.getTime() < now.getTime() - 45 * DAY_MS) return []
    const isNews = n.source !== 'WARN_FILING' && why !== 'sec-filing'
    if (isNews && looksNonUs(heads)) return []
    return [{ n, why }]
  })
  rows.sort((a, b) => CRED_RANK[b.why] - CRED_RANK[a.why] || (b.n.employees ?? 0) - (a.n.employees ?? 0))
  const seen: EventRef[] = []
  const out: LayoffCandidate[] = []
  for (const { n, why } of rows) {
    const ref: EventRef = { employer: n.employer, employees: n.employees, date: n.noticeDate }
    if (seen.some((s) => sameEvent(s, ref))) continue
    seen.push(ref)
    out.push({
      employer: n.employer, employees: n.employees ?? 0, state: n.state,
      place: n.county && n.state ? `${n.county.replace(/ county$/i, '')} County, ${n.state}` : n.state,
      effectiveDate: n.effectiveDate, noticeDate: n.noticeDate, credibility: why,
      slug: employerSlug(n.employer, null), sourceUrl: n.sourceUrl,
    })
  }
  return out
}

const asOfLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

export async function generateDailyDrafts(now = new Date()): Promise<GenerateResult> {
  const day = easternDay(now)
  const result: GenerateResult = { day, created: [], skipped: [] }
  const since = (days: number) => easternDay(new Date(now.getTime() - days * DAY_MS))
  const recent = await prisma.contentDraft.findMany({
    where: { day: { gte: since(AI_JOB_REPEAT_DAYS) } },
    select: { day: true, kind: true, subject: true, big: true, status: true },
  })
  const today = recent.filter((r) => r.day === day)

  const cards: { card: Card; facts: Record<string, unknown> }[] = []

  // Layoffs: the biggest credible ones not drafted lately, and a deadline card for the nearest last day.
  const layoffs = await loadLayoffCandidates(now)
  const lately = new Set(recent.filter((r) => r.kind === 'layoff' && r.day >= since(REPEAT_DAYS)).map((r) => r.subject))
  const room = Math.max(0, LAYOFFS_PER_DAY - today.filter((r) => r.kind === 'layoff').length)
  for (const l of layoffs.filter((x) => !lately.has(x.slug)).slice(0, room)) {
    cards.push({
      card: layoffCard({ ...l, openRolesInState: null }),
      facts: { employer: l.employer, employees: l.employees, state: l.state, noticeDate: l.noticeDate?.toISOString() ?? null, effectiveDate: l.effectiveDate?.toISOString() ?? null, credibility: l.credibility, sourceUrl: l.sourceUrl },
    })
  }
  const upcoming = layoffs
    .filter((l) => l.effectiveDate && l.effectiveDate.getTime() >= now.getTime() - DAY_MS && l.effectiveDate.getTime() <= now.getTime() + 45 * DAY_MS)
    .sort((a, b) => (a.effectiveDate as Date).getTime() - (b.effectiveDate as Date).getTime())[0]
  const generalLately = recent.some((r) => r.kind === 'deadline' && r.subject === 'general' && r.day >= since(REPEAT_DAYS))
  if (upcoming) {
    cards.push({ card: deadlineCard({ lastDay: upcoming.effectiveDate, employer: upcoming.employer, state: upcoming.state }), facts: { employer: upcoming.employer, employees: upcoming.employees, state: upcoming.state, effectiveDate: upcoming.effectiveDate?.toISOString() ?? null, credibility: upcoming.credibility, sourceUrl: upcoming.sourceUrl } })
  } else if (!generalLately) {
    cards.push({ card: deadlineCard({ lastDay: null, employer: null, state: null }), facts: { rule: 'COBRA and Marketplace 60-day windows; file for unemployment first' } })
  }

  // Job of the day: the next occupation in the rotation that has an exposure score and was not drafted in 90 days.
  try {
    const [map, usedSocs] = [await loadExposureMap(), new Set(recent.filter((r) => r.kind === 'ai-job').map((r) => r.subject))]
    const start = Math.floor(now.getTime() / DAY_MS)
    for (let i = 0; i < occupations.length; i++) {
      const o = occupations[(start + i) % occupations.length]
      const e = map.get(o.soc)
      if (!e || usedSocs.has(o.soc)) continue
      const occ = await prisma.occupation.findUnique({ where: { socCode: `${o.soc}.00` }, select: { medianWage: true, growthPct: true } })
      cards.push({ card: aiJobCard({ soc6: o.soc, title: e.title, score: e.score, medianWage: occ?.medianWage ?? null, growthPct: occ?.growthPct ?? null }), facts: { soc: o.soc, title: e.title, observedExposure: e.score, source: 'Anthropic Economic Index, March 2026' } })
      break
    }
  } catch (e) {
    console.error('Content drafts: job of the day unavailable', e)
  }

  // AI pay premium and the entry/senior number, from the latest stored market snapshot.
  const snap = await prisma.aiMarketSnapshot.findFirst({ orderBy: { computedAt: 'desc' }, select: { computedAt: true, data: true } })
  if (snap) {
    const data = snap.data as unknown as AiMarketData
    const asOf = asOfLabel(snap.computedAt)
    const o = data.overall
    if (o) {
      const like = o.likePct != null
      cards.push({ card: aiPayCard({ pct: like ? (o.likePct as number) : o.rawPct, likeForLike: like, nAi: o.nAi, nBase: o.nBase, liveJobs: data.counts.live, aiSkillJobs: data.counts.aiSkill, asOf }), facts: { snapshotAt: snap.computedAt.toISOString(), rawPct: o.rawPct, likePct: o.likePct ?? null, nAi: o.nAi, nBase: o.nBase } })
    }
    const evenDay = Math.floor(now.getTime() / DAY_MS) % 2 === 0
    const lv = (data.dimensions?.level ?? []).filter((r) => r.key === 'director' || r.key === 'vp')
    const sn = lv.reduce((s, r) => s + r.n, 0)
    const sa = lv.reduce((s, r) => s + r.aiSkill, 0)
    if (!evenDay && sn >= 100) {
      cards.push({ card: seniorCard({ n: sn, aiSkill: sa, sharePct: (100 * sa) / sn, asOf }), facts: { snapshotAt: snap.computedAt.toISOString(), n: sn, aiSkill: sa } })
    } else if (data.entry) {
      const e = data.entry
      cards.push({ card: entryCard({ entry: e.entry, liveUs: e.liveUs, noExp: e.noExp, training: e.training ?? null, asOf }), facts: { snapshotAt: snap.computedAt.toISOString(), ...e, byFunction: undefined, byIndustry: undefined, bySector: undefined } })
    }
  }

  for (const { card, facts } of cards) {
    // A data card whose number has not moved since its last draft is not worth posting again so soon.
    const unchanged = (card.kind === 'ai-pay' || card.kind === 'market') &&
      recent.some((r) => r.kind === card.kind && r.subject === card.subject && r.big === card.big && r.day >= since(SAME_NUMBER_DAYS))
    const id = `${card.kind}:${card.subject}`
    if (unchanged) { result.skipped.push(id); continue }
    const campaign = campaignFor(day, card)
    try {
      await prisma.contentDraft.create({
        data: {
          day, kind: card.kind, subject: card.subject, headline: card.headline, big: card.big, bigLabel: card.bigLabel, campaign,
          versions: buildVersions(card, campaign) as unknown as Prisma.InputJsonValue,
          facts: { ...facts, source: card.source, path: card.path, points: card.points } as unknown as Prisma.InputJsonValue,
        },
      })
      result.created.push(id)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') { result.skipped.push(id); continue }
      throw e
    }
  }
  captureServerEvent('cron', 'content_drafts_generated', { day, created: result.created.length, skipped: result.skipped.length, kinds: result.created })
  return result
}
