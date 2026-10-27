/**
 * Pure rules for pushing what we learn about a competitor into the rest of the product: product-list ideas from the
 * features we lack, CRM organizations and dates from the contracts they win, and the "full download" email.
 */
import type { NamedEntry, WinEntry } from './competitor-areas'

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** "We need" lines worth a product idea: short enough to be a title, once each, ignoring repeats of existing titles. */
export function gapIdeas(weNeed: string[], existingTitles: string[], max = 8): string[] {
  const have = new Set(existingTitles.map(key))
  const out: string[] = []
  for (const raw of weNeed) {
    const title = raw.replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '').slice(0, 140)
    if (title.length < 8 || have.has(key(title))) continue
    have.add(key(title))
    out.push(title)
    if (out.length >= max) break
  }
  return out
}

/**
 * Ideas made from competitor gaps carry "Seen at competitors: A; B". The names are separated by "; " because company
 * names contain commas ("Kuder, Inc."). One that only a single competitor has is a weak signal, so Brainstorm keeps
 * those in a secondary list and the primary list holds the ones two or more share.
 */
const SEEN_SEP = '; '
export const SINGLE_COMPETITOR_GAP = { body: { startsWith: 'Seen at competitors: ' }, NOT: { body: { contains: SEEN_SEP } } } as const

/** Adds a competitor's name to an idea's "seen at" line without repeating it. */
export function addSeenAt(body: string | null, competitor: string): string {
  const m = (body ?? '').match(/^Seen at competitors: (.*)$/m)
  if (!m) return `Seen at competitors: ${competitor}${body ? `\n${body}` : ''}`
  const names = m[1].split(SEEN_SEP).filter(Boolean)
  if (names.some((n) => key(n) === key(competitor))) return body!
  return (body ?? '').replace(m[0], `Seen at competitors: ${[...names, competitor].join(SEEN_SEP)}`)
}

/** Other wordings of the same gap, kept on the idea ("Also worded: ...", one per line) so a gap absorbed into it is recognised next run instead of being sent to the model again. */
export const wordingsOf = (body: string | null): string[] => [...(body ?? '').matchAll(/^Also worded: (.*)$/gm)].map((m) => m[1].trim()).filter(Boolean)
export function addWording(body: string | null, title: string): string {
  const k = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (wordingsOf(body).some((w) => k(w) === k(title))) return body ?? ''
  return `${body ?? ''}${body ? '\n' : ''}Also worded: ${title.replace(/\s+/g, ' ').replace(/;\s*/g, ', ').trim()}`  // no "; ", which marks a second competitor
}

export interface GapMatches {
  /** New gap index -> existing idea index it restates. */
  matches: Map<number, number>
  /** New gaps that restate each other but nothing existing: one idea, titled with the capability. */
  groups: { label: string; members: number[] }[]
}

export function gapMatchPrompt(existingTitles: string[], news: { title: string }[]): string {
  return [
    'NextChapter is a career-transition platform. Below are EXISTING product ideas (E, index, title) and NEW competitor gaps (N, index, title).',
    'Decide, for each NEW gap, whether it describes the SAME product capability as an existing idea or as another new gap. Be strict: same capability, not merely the same topic.',
    'Return JSON only: {"matches":[{"new":i,"existing":j}],"groups":[{"label":"short name of the capability","members":[i,j,...]}]}.',
    '"matches" lists NEW gaps that restate an EXISTING idea. "groups" lists sets of 2+ NEW gaps that restate each other and match no existing idea. Leave unique gaps out.',
    '', 'EXISTING', ...existingTitles.map((t, i) => `E${i}\t${t}`), '', 'NEW', ...news.map((n, i) => `N${i}\t${n.title}`),
  ].join('\n')
}

/** Reads the model's answer, dropping anything out of range, repeated, or not a real group, so a bad answer can only under-match. */
export function parseGapMatches(text: string, newCount: number, existingCount: number): GapMatches {
  const out: GapMatches = { matches: new Map(), groups: [] }
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return out
  let j: { matches?: unknown; groups?: unknown }
  try { j = JSON.parse(m[0]) } catch { return out }
  const idx = (v: unknown, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < max ? v : null)
  for (const x of Array.isArray(j.matches) ? j.matches : []) {
    const n = idx(x?.new, newCount), e = idx(x?.existing, existingCount)
    if (n !== null && e !== null && !out.matches.has(n)) out.matches.set(n, e)
  }
  const used = new Set(out.matches.keys())
  for (const g of Array.isArray(j.groups) ? j.groups : []) {
    const label = typeof g?.label === 'string' ? g.label.replace(/\s+/g, ' ').trim().slice(0, 140) : ''
    const members = [...new Set((Array.isArray(g?.members) ? g.members : []).map((v: unknown) => idx(v, newCount)).filter((v: number | null): v is number => v !== null && !used.has(v)))] as number[]
    if (label.length < 8 || members.length < 2) continue
    members.forEach((v) => used.add(v))
    out.groups.push({ label, members })
  }
  return out
}

export interface AwardRow { awardKey: string; description: string | null; agency: string | null; subAgency: string | null; amount: number; startDate: Date | null; endDate: Date | null; url: string }

export interface CrmWin {
  buyer: string
  title: string
  amount: number | null
  when: Date | null
  /** Contract end date in the future: when the buyer will likely go to market again. */
  rebidAt: Date | null
  url: string | null
  ref: string
}

export function winsFromAwards(competitor: string, awards: AwardRow[], now: Date): CrmWin[] {
  const out: CrmWin[] = []
  for (const a of awards) {
    const buyer = (a.subAgency && a.subAgency.length < 80 ? a.subAgency : a.agency)?.trim()
    if (!buyer) continue
    out.push({
      buyer, title: `${competitor} won: ${(a.description ?? 'federal award').replace(/\s+/g, ' ').slice(0, 140)}`, amount: a.amount > 0 ? a.amount : null,
      when: a.startDate, rebidAt: a.endDate && a.endDate.getTime() > now.getTime() ? a.endDate : null, url: a.url, ref: `competitor-win:${a.awardKey}`,
    })
  }
  return out
}

/** Wins the card lists with a named buyer. The year is only a year, so it dates the win to 1 January of that year. */
export function winsFromCard(competitor: string, wins: WinEntry[]): CrmWin[] {
  const out: CrmWin[] = []
  for (const w of wins) {
    const buyer = w.buyer?.trim()
    if (!buyer || buyer.length > 100) continue
    const y = Number(String(w.year ?? '').match(/20\d\d|19\d\d/)?.[0])
    out.push({
      buyer, title: `${competitor} won: ${w.what}`.slice(0, 200), amount: null,
      when: Number.isFinite(y) ? new Date(Date.UTC(y, 0, 1)) : null, rebidAt: null, url: w.url ?? null, ref: `competitor-win:card:${key(competitor)}:${key(w.what)}`,
    })
  }
  return out
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const list = (items: string[]) => (items.length ? `<ul style="margin:4px 0 12px;padding-left:20px">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p style="margin:4px 0 12px;color:#666">None found.</p>')
const h = (t: string) => `<h3 style="margin:16px 0 0;font-size:15px">${esc(t)}</h3>`

export interface DownloadCard {
  name: string; url: string | null; relationship: string; segment: string | null; positioning: string | null; status: string; statusNote: string | null
  hq: string | null; foundedYear: number | null; headcount: number | null; fundingRaisedUsd: number | null; lastRound: string | null; investors: string | null
  revenueNote: string | null; userCountNote: string | null; pricingNote: string | null
  keyFeatures: string[]; customers: NamedEntry[]; wins: WinEntry[]; weWin: string[]; theyWin: string[]; weNeed: string[]; lessons: string[]
  partnerIdea: string | null; notes: string | null; sourceUrl: string | null
}

/** The full competitor download as one email: who they are, strengths and weaknesses, gaps, what they have won, who they sell to. */
export function downloadEmail(c: DownloadCard, cardUrl: string): { subject: string; html: string } {
  const facts = [
    c.hq && `HQ ${c.hq}`, c.foundedYear && `founded ${c.foundedYear}`, c.headcount && `${c.headcount.toLocaleString('en-US')} staff`,
    c.fundingRaisedUsd && `$${Math.round(c.fundingRaisedUsd / 1e6)}M raised`, c.lastRound, c.investors && `investors: ${c.investors}`, c.revenueNote, c.userCountNote, c.pricingNote && `pricing: ${c.pricingNote}`,
  ].filter(Boolean) as string[]
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.45;max-width:640px">
<h2 style="margin:0 0 4px">${esc(c.name)}</h2>
<p style="margin:0;color:#555">${esc(c.relationship)}${c.segment ? ` · ${esc(c.segment)}` : ''}${c.status !== 'ACTIVE' ? ` · <strong>${esc(c.status)}</strong>` : ''}${c.url ? ` · <a href="${esc(c.url)}">${esc(c.url)}</a>` : ''}</p>
${c.positioning ? `<p>${esc(c.positioning)}</p>` : ''}
${c.statusNote ? `<p><strong>Status:</strong> ${esc(c.statusNote)}</p>` : ''}
${facts.length ? `<p style="color:#444">${facts.map(esc).join(' · ')}</p>` : ''}
${h('Where they are stronger')}${list(c.theyWin)}
${h('Where we are stronger (their weaknesses)')}${list(c.weWin)}
${h('What we would need to build or improve (gaps)')}${list(c.weNeed)}
${h('Grants, contracts and RFPs they have won')}${list(c.wins.map((w) => [w.what, w.buyer, w.amount, w.year].filter(Boolean).join(' — ')))}
${h('Customers they name')}${list(c.customers.map((x) => x.name + (x.note ? ` — ${x.note}` : '')))}
${h('Key features')}${list(c.keyFeatures)}
${c.lessons.length ? h('What we can learn from them') + list(c.lessons) : ''}
${c.partnerIdea ? `${h('Partner idea')}<p>${esc(c.partnerIdea)}</p>` : ''}
${c.notes ? `${h('Notes')}<p>${esc(c.notes)}</p>` : ''}
<p style="margin-top:18px"><a href="${esc(cardUrl)}">Open the card</a>${c.sourceUrl ? ` · <a href="${esc(c.sourceUrl)}">best source</a>` : ''}. This is a draft read from public pages: check it before relying on a number.</p>
</div>`
  return { subject: `Competitor added: ${c.name}`, html }
}
