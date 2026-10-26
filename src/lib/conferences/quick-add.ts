import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { canonicalUrlKey, isDeepLinkOnly, nameKey, seriesSlug, yearFromText } from './canonical'
import { findExistingSeries } from './dedupe'
import { extractWithModel, fetchConferencePages } from './extract'
import { missingFields, sanitizeExtraction, type Extraction } from './sanitize'
import { QUICK_ADD_DAILY_CAP } from './constants'
import { ensureEdition } from './editions'
import { setUserStatus } from './tracking'

/** A readable placeholder name from the link when the page gave none: "careertech-vision" becomes "Careertech Vision". */
export function nameFromUrl(input: string): string {
  try {
    const u = new URL(input)
    const seg = u.pathname.split('/').filter((x) => x && !/^\d+$/.test(x) && !/^(events?|e|www|index|home)$/i.test(x)).pop()
    const words = (seg ?? u.hostname.replace(/^www\./, '').split('.')[0]).replace(/\.[a-z]{2,5}$/i, '').split(/[-_+]+/).filter(Boolean)
    const title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim()
    return title.slice(0, 120) || u.hostname
  } catch { return 'Conference' }
}

const CACHE_DAYS = 14
const DAY = 86_400_000

export interface QuickAddCard extends Extraction {
  url: string
  urlKey: string
  /** We did not read the page (login-walled host, fetch failed, or the daily limit): the member fills the card in. */
  manual: 'deep_link' | 'fetch_failed' | 'daily_limit' | null
  missing: string[]
}

export type QuickAddPreview =
  | { status: 'invalid' }
  | { status: 'rejected'; note: string | null }
  | { status: 'exists'; seriesId: string; name: string; by: 'url' | 'name' }
  | { status: 'card'; card: QuickAddCard; fromCache: boolean }

const blank = (): Extraction => ({ name: null, organizer: null, startDate: null, endDate: null, format: null, city: null, state: null, country: null, costLow: null, costHigh: null, costNote: null, industries: [], functions: [], seniorities: [], whyAttend: null, opportunities: [] })

async function candidates(urlKey: string) {
  const host = urlKey.split('/')[0]
  return prisma.conferenceEvent.findMany({ where: { OR: [{ urlKey: { startsWith: host } }, { urlKey }] }, select: { id: true, name: true, urlKey: true, rejectedAt: true, rejectedNote: true } })
}

/** Attach the member to a series that is already in the catalog. Only the member's own row is written. */
async function attach(candidateId: string, seriesId: string, via: string) {
  await setUserStatus(candidateId, seriesId, 'INTERESTED', { onlyIfNew: true })
  captureServerEvent(candidateId, 'conference_quick_add_attached', { seriesId, via })
}

export async function previewQuickAdd(candidateId: string, rawUrl: string, now = new Date()): Promise<QuickAddPreview> {
  const urlKey = canonicalUrlKey(rawUrl)
  if (!urlKey) return { status: 'invalid' }
  const url = rawUrl.trim()

  const nearby = await candidates(urlKey)
  const known = findExistingSeries(nearby, { urlKey, name: null })
  if (known) {
    const row = await prisma.conferenceEvent.findUniqueOrThrow({ where: { id: known.id }, select: { name: true, rejectedAt: true, rejectedNote: true } })
    // We turned this one down earlier: say so, with the reason, instead of adding it again.
    if (row.rejectedAt) return { status: 'rejected', note: row.rejectedNote }
    await attach(candidateId, known.id, 'url')
    return { status: 'exists', seriesId: known.id, name: row.name, by: known.by }
  }

  const done = (ex: Extraction, manual: QuickAddCard['manual'], fromCache = false): QuickAddPreview => ({
    status: 'card', fromCache, card: { ...ex, url, urlKey, manual, missing: missingFields(ex) },
  })

  if (isDeepLinkOnly(url)) {
    captureServerEvent(candidateId, 'conference_quick_add_previewed', { urlKey, outcome: 'deep_link' })
    return done(blank(), 'deep_link')
  }

  const cached = await prisma.conferenceExtraction.findUnique({ where: { urlKey } })
  let ex: Extraction | null = null
  let fromCache = false
  if (cached && now.getTime() - cached.createdAt.getTime() < CACHE_DAYS * DAY) {
    ex = sanitizeExtraction(cached.result as Record<string, unknown>, url)
    fromCache = true
  } else {
    const used = await prisma.conferenceQuickAddLog.count({ where: { candidateId, usedModel: true, createdAt: { gt: new Date(now.getTime() - DAY) } } })
    if (used >= QUICK_ADD_DAILY_CAP) {
      captureServerEvent(candidateId, 'conference_quick_add_previewed', { urlKey, outcome: 'daily_limit' })
      return done(blank(), 'daily_limit')
    }
    const page = await fetchConferencePages(url)
    if (!page) {
      captureServerEvent(candidateId, 'conference_quick_add_previewed', { urlKey, outcome: 'fetch_failed' })
      return done(blank(), 'fetch_failed')
    }
    const r = await extractWithModel(page)
    await prisma.conferenceQuickAddLog.create({ data: { candidateId, urlKey, usedModel: true } })
    if (!r) return done(blank(), 'fetch_failed')
    ex = r.extraction
    await prisma.conferenceExtraction.upsert({ where: { urlKey }, create: { urlKey, result: ex as object, contentHash: page.hash }, update: { result: ex as object, contentHash: page.hash, createdAt: now } })
    captureServerEvent(candidateId, 'conference_quick_add_extracted', { urlKey, inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, costUsd: r.usage.costUsd, opportunities: ex.opportunities.length })
  }

  // The page may name an event we hold under another link: same name and year is the same event.
  const byName = ex.name ? findExistingSeries(await prisma.conferenceEvent.findMany({ select: { id: true, name: true, urlKey: true } }), { urlKey: null, name: ex.name }) : null
  if (byName) {
    const row = await prisma.conferenceEvent.findUniqueOrThrow({ where: { id: byName.id }, select: { name: true, rejectedAt: true, rejectedNote: true } })
    if (row.rejectedAt) return { status: 'rejected', note: row.rejectedNote }
    await attach(candidateId, byName.id, 'name')
    return { status: 'exists', seriesId: byName.id, name: row.name, by: 'name' }
  }
  captureServerEvent(candidateId, 'conference_quick_add_previewed', { urlKey, outcome: 'card', fromCache, missing: missingFields(ex).length })
  return done(ex, null, fromCache)
}

/** Saves the confirmed (possibly edited) card as a new, unpublished catalog entry and tracks it for the member. */
export async function confirmQuickAdd(candidateId: string, input: Record<string, unknown> & { url: string }): Promise<{ seriesId: string; created: boolean } | null> {
  const urlKey = canonicalUrlKey(input.url)
  if (!urlKey) return null
  const ex = sanitizeExtraction(input, input.url)
  const name = ex.name ?? nameFromUrl(input.url)

  const rows = await prisma.conferenceEvent.findMany({ select: { id: true, name: true, urlKey: true, rejectedAt: true } })
  const hit = findExistingSeries(rows, { urlKey, name: ex.name })
  // Never re-add (or attach anyone to) an entry we turned down.
  if (hit && rows.find((r) => r.id === hit.id)?.rejectedAt) return null
  if (hit) {
    await attach(candidateId, hit.id, hit.by)
    return { seriesId: hit.id, created: false }
  }

  let id = seriesSlug(name) || 'conference'
  if (rows.some((r) => r.id === id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`
  const hasDates = !!ex.startDate
  await prisma.conferenceEvent.create({
    data: {
      id, name, organizer: ex.organizer, url: input.url.trim(), urlKey,
      format: ex.format ?? 'IN_PERSON',
      startDate: ex.startDate ? new Date(`${ex.startDate}T00:00:00Z`) : null,
      endDate: ex.endDate ? new Date(`${ex.endDate}T00:00:00Z`) : null,
      datesConfirmed: hasDates,
      city: ex.city, state: ex.state, country: ex.country ?? 'US',
      industries: ex.industries, functions: ex.functions, seniorities: ex.seniorities,
      whyAttend: ex.whyAttend, costLow: ex.costLow, costHigh: ex.costHigh, costNote: ex.costNote,
      published: false, verified: false, source: 'quick-add', addedBy: candidateId,
    },
  })
  const year = ex.startDate ? Number(ex.startDate.slice(0, 4)) : yearFromText(name, input.url) ?? new Date().getUTCFullYear()
  const edition = await ensureEdition(id, year, {
    startDate: ex.startDate ? new Date(`${ex.startDate}T00:00:00Z`) : null,
    endDate: ex.endDate ? new Date(`${ex.endDate}T00:00:00Z`) : null,
    status: hasDates ? 'CONFIRMED' : 'TBA', format: ex.format, city: ex.city, state: ex.state, country: ex.country, url: input.url.trim(),
  })
  if (ex.opportunities.length > 0) {
    await prisma.conferenceOpportunity.createMany({
      data: ex.opportunities.map((o) => ({
        seriesId: id, editionId: edition.id, type: o.type, title: o.title, url: o.url,
        opensAt: o.opensAt ? new Date(`${o.opensAt}T00:00:00Z`) : null, deadline: o.deadline ? new Date(`${o.deadline}T00:00:00Z`) : null,
        published: false, source: 'QUICK_ADD',
      })),
    })
  }
  await setUserStatus(candidateId, id, 'INTERESTED', { editionId: edition.id })
  captureServerEvent(candidateId, 'conference_quick_add_confirmed', { seriesId: id, opportunities: ex.opportunities.length, hadDates: hasDates, nameKey: nameKey(name) })
  return { seriesId: id, created: true }
}

export type QuickAddResult =
  | { status: 'invalid' }
  | { status: 'rejected'; note: string | null }
  | { status: 'ready'; seriesId: string; name: string; created: boolean; read: 'full' | 'walled' | 'failed' | 'limit' }

/**
 * Paste a link, get a conference. No review step: the page is read, the entry is added to the member's list straight
 * away, and the member can edit it afterwards. Entries wait unpublished for our own review; if we reject one, the
 * members who added it are told why.
 */
export async function quickAdd(candidateId: string, rawUrl: string, now = new Date()): Promise<QuickAddResult> {
  const preview = await previewQuickAdd(candidateId, rawUrl, now)
  if (preview.status === 'invalid') return { status: 'invalid' }
  if (preview.status === 'rejected') return { status: 'rejected', note: preview.note }
  if (preview.status === 'exists') return { status: 'ready', seriesId: preview.seriesId, name: preview.name, created: false, read: 'full' }
  const { card } = preview
  const saved = await confirmQuickAdd(candidateId, { ...card, opportunities: card.opportunities })
  if (!saved) return { status: 'invalid' }
  const read = card.manual === 'deep_link' ? 'walled' : card.manual === 'fetch_failed' ? 'failed' : card.manual === 'daily_limit' ? 'limit' : 'full'
  const row = await prisma.conferenceEvent.findUniqueOrThrow({ where: { id: saved.seriesId }, select: { name: true } })
  return { status: 'ready', seriesId: saved.seriesId, name: row.name, created: saved.created, read }
}
