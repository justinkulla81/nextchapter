/**
 * Pure rules behind the competitor watch: the spend cap, which cards are due, how model output is cleaned into
 * events and proposed matrix cells, and how a refresh merges into a card (it adds, it never deletes).
 * No database and no clock reads except through arguments, so all of it is testable.
 */
import { cleanUrl, type NamedEntry, type WinEntry } from './competitor-areas'

export const EVENT_KINDS = ['NEWS', 'WIN', 'LOGO', 'FUNDING', 'ACQUISITION', 'LAYOFF', 'CLOSURE'] as const
export type EventKind = (typeof EVENT_KINDS)[number]
export const EVENT_LABEL: Record<EventKind, string> = {
  NEWS: 'News', WIN: 'Grant or contract won', LOGO: 'New customer', FUNDING: 'Funding', ACQUISITION: 'Acquisition', LAYOFF: 'Layoffs', CLOSURE: 'Shut down',
}

export const REFRESH_EVERY_DAYS = 30
export const NEWS_EVERY_DAYS = 7
/** Estimated cost of one call, used to refuse a call that would cross the cap. Real cost is recorded after. */
export const EST_COST = { refresh: 0.06, news: 0.04 }

export const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

/** True when one more call of this kind still fits under the hard monthly cap. */
export function fitsCap(spentUsd: number, capUsd: number, kind: keyof typeof EST_COST): boolean {
  return capUsd > 0 && spentUsd + EST_COST[kind] <= capUsd
}

export interface DueInput { id: string; status: string; url: string | null; relationship: string; watchRefreshedAt: Date | null; watchNewsAt: Date | null }

/** Cards due for a refresh (all active cards with a site) or the news watch (active direct and adjacent), oldest-read first. */
export function pickDue(cards: DueInput[], kind: 'refresh' | 'news', now: Date, limit: number): DueInput[] {
  const days = kind === 'refresh' ? REFRESH_EVERY_DAYS : NEWS_EVERY_DAYS
  const field = kind === 'refresh' ? 'watchRefreshedAt' : 'watchNewsAt'
  const cutoff = now.getTime() - days * 86_400_000
  return cards
    .filter((c) => c.status === 'ACTIVE' && c.url && (kind === 'refresh' || c.relationship === 'DIRECT' || c.relationship === 'ADJACENT'))
    .filter((c) => !c[field] || c[field]!.getTime() <= cutoff)
    .sort((a, b) => (a[field]?.getTime() ?? 0) - (b[field]?.getTime() ?? 0))
    .slice(0, Math.max(0, limit))
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

export interface CleanEvent { kind: EventKind; title: string; summary: string | null; url: string | null; amountUsd: number | null; occurredAt: Date | null; dedupeKey: string }

function urlKey(u: string): string | null {
  try { const x = new URL(u); return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/$/, '')}`.toLowerCase() } catch { return null }
}

/** Cleans model-returned events. A news item without a link is dropped: an unsourced story is not worth a digest line. */
export function cleanEvents(raw: unknown, now: Date, maxAgeDays = 400, max = 12): CleanEvent[] {
  if (!Array.isArray(raw)) return []
  const out: CleanEvent[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const kind = String(o.kind ?? '').toUpperCase() as EventKind
    if (!EVENT_KINDS.includes(kind)) continue
    const title = String(o.title ?? '').trim().slice(0, 200)
    const url = cleanUrl(o.url) ?? null
    if (!title || !url) continue
    const d = o.date ? new Date(String(o.date)) : null
    const occurredAt = d && !Number.isNaN(d.getTime()) && d.getTime() <= now.getTime() + 86_400_000 ? d : null
    if (occurredAt && now.getTime() - occurredAt.getTime() > maxAgeDays * 86_400_000) continue
    const amt = typeof o.amountUsd === 'number' && o.amountUsd > 0 ? o.amountUsd : null
    const dedupeKey = `${kind}:${urlKey(url) ?? norm(title)}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    const summary = String(o.summary ?? '').trim().slice(0, 500) || null
    out.push({ kind, title, summary, url, amountUsd: amt, occurredAt, dedupeKey })
    if (out.length >= max) break
  }
  return out
}

export interface CleanProposal { key: string; status: 'YES' | 'PARTIAL' | 'NO'; evidenceUrl: string; note: string | null }

/** Only known capabilities, only YES/PARTIAL/NO, only with an https evidence link: the same bar a hand-set cell has. */
export function cleanProposals(raw: unknown, validKeys: Set<string>, max = 25): CleanProposal[] {
  if (!Array.isArray(raw)) return []
  const out: CleanProposal[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const key = String(o.key ?? '').trim()
    const status = String(o.status ?? '').toUpperCase()
    const ev = cleanUrl(o.evidenceUrl)
    if (!validKeys.has(key) || seen.has(key) || !ev || !ev.startsWith('https://')) continue
    if (status !== 'YES' && status !== 'PARTIAL' && status !== 'NO') continue
    seen.add(key)
    out.push({ key, status, evidenceUrl: ev, note: String(o.note ?? '').trim().slice(0, 160) || null })
    if (out.length >= max) break
  }
  return out
}

/** Customer logos in the fresh read that the card did not already have. */
export function newCustomers(current: NamedEntry[], incoming: NamedEntry[]): NamedEntry[] {
  const have = new Set(current.map((x) => norm(x.name)))
  return incoming.filter((x) => x.name && !have.has(norm(x.name)))
}
export function newWins(current: WinEntry[], incoming: WinEntry[]): WinEntry[] {
  const have = new Set(current.map((x) => norm(x.what)))
  return incoming.filter((x) => x.what && !have.has(norm(x.what)))
}

/** Events a refresh implies by comparing the card before and after: new logos, new wins, a new round, a status change. */
export function eventsFromDiff(
  before: { customers: NamedEntry[]; wins: WinEntry[]; lastRound: string | null; status: string },
  after: { customers: NamedEntry[]; wins: WinEntry[]; lastRound: string | null; status: string; statusNote: string | null; sourceUrl: string | null },
): CleanEvent[] {
  const out: CleanEvent[] = []
  for (const c of newCustomers(before.customers, after.customers)) {
    out.push({ kind: 'LOGO', title: `New customer: ${c.name}`, summary: c.note ?? null, url: c.url ?? null, amountUsd: null, occurredAt: null, dedupeKey: `LOGO:${norm(c.name)}` })
  }
  for (const w of newWins(before.wins, after.wins)) {
    out.push({ kind: 'WIN', title: w.what.slice(0, 200), summary: [w.buyer, w.amount, w.year].filter(Boolean).join(' · ') || null, url: w.url ?? null, amountUsd: null, occurredAt: null, dedupeKey: `WIN:${norm(w.what)}` })
  }
  if (after.lastRound && after.lastRound !== before.lastRound) {
    out.push({ kind: 'FUNDING', title: `Funding: ${after.lastRound}`, summary: null, url: after.sourceUrl, amountUsd: null, occurredAt: null, dedupeKey: `FUNDING:${norm(after.lastRound)}` })
  }
  if (after.status !== 'ACTIVE' && after.status !== before.status) {
    const kind: EventKind = after.status === 'ACQUIRED' ? 'ACQUISITION' : 'CLOSURE'
    out.push({ kind, title: `${kind === 'ACQUISITION' ? 'Acquired or merged' : after.status === 'SHUT_DOWN' ? 'Shut down' : 'Left the market'}`, summary: after.statusNote, url: after.sourceUrl, amountUsd: null, occurredAt: null, dedupeKey: `${kind}:${norm(after.statusNote ?? after.status)}` })
  }
  return out
}

const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
export function unionNamed<T extends { name?: string; what?: string }>(current: T[], incoming: T[], max: number): T[] {
  const seen = new Set(current.map((x) => keyOf(x.name ?? x.what ?? '')))
  return [...current, ...incoming.filter((x) => !seen.has(keyOf(x.name ?? x.what ?? '')))].slice(0, max)
}
export const unionStrings = (a: string[], b: string[], max: number) => [...new Set([...a, ...b])].slice(0, max)

/** Groups events for the digest: layoffs, closures, acquisitions and funding first, then wins, logos and general news. */
export function digestOrder(kind: string): number {
  return ['CLOSURE', 'ACQUISITION', 'LAYOFF', 'FUNDING', 'WIN', 'LOGO', 'NEWS'].indexOf(kind)
}
