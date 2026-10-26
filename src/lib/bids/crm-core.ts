// Pure rules for filing bids and competitor wins into the CRM and cross-referencing them. Tested in
// src/test/bid-crm-core.test.ts.

export type BidEligibility = 'DIRECT' | 'VIA_PARTNER' | 'UNKNOWN'

/**
 * Can NextChapter bid on the NEXT award like this one? A federal contract is full and open unless the notice sets it
 * aside (small business and similar), so a for-profit can bid; a federal grant normally goes to nonprofits, states,
 * colleges and boards, so we would go in through a partner. Neither says anything about the notice that will actually
 * be posted: that is read when it appears.
 */
export function awardEligibility(kind: 'CONTRACT' | 'GRANT'): { eligibility: BidEligibility; note: string } {
  return kind === 'CONTRACT'
    ? { eligibility: 'DIRECT', note: 'Contract: open to for-profit bidders unless the next notice sets it aside (small business and similar). Check the notice.' }
    : { eligibility: 'VIA_PARTNER', note: 'Grant: normally for nonprofits, states, colleges and boards, so we would apply through a partner.' }
}

/** A board's own page rarely states size or who may apply on the listing line. Say so instead of guessing. */
export const BOARD_BID_ELIGIBILITY = { eligibility: 'UNKNOWN' as BidEligibility, note: 'Size and who may apply are not on the board\'s listing. Open the bid document.' }

const STOP = new Set(['request', 'proposal', 'proposals', 'services', 'service', 'program', 'programs', 'provide', 'providing', 'contract', 'order', 'task', 'support', 'with', 'from', 'that', 'this', 'will', 'under', 'award', 'awards', 'purpose', 'county', 'state', 'federal', 'department', 'national', 'delivery', 'related', 'needed', 'work', 'year', 'years', 'base', 'option', 'period', 'including', 'quotes', 'quote', 'information', 'solicitation'])

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)))
}

/** How many informative words two descriptions share. Two or more is "similar". */
export function sharedWords(a: string, b: string): number {
  const x = words(a), y = words(b)
  let n = 0
  for (const w of x) if (y.has(w)) n++
  return n
}

export interface Comparable { id: string; text: string }

/** The candidates most like `text`, best first, needing at least two shared words. */
export function mostSimilar<T extends Comparable>(text: string, candidates: T[], max = 3): T[] {
  return candidates
    .map((c) => ({ c, n: sharedWords(text, c.text) }))
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((x) => x.c)
}

const money = (n: number) => (n >= 1_000_000_000 ? `$${(n / 1_000_000_000).toFixed(1)}B` : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString('en-US')}`)
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

export function bidNote(b: { title: string; boardName: string; state: string; deadline: Date | null; url: string; pageUrl: string }): { subject: string; body: string } {
  return {
    subject: `Open bid: ${b.title}`.slice(0, 200),
    body: [
      `Board: ${b.boardName} (${b.state})`,
      b.deadline ? `Due: ${day(b.deadline)}` : 'Due: no deadline on the page',
      `Size: not stated on the listing`,
      `Who may apply: ${BOARD_BID_ELIGIBILITY.note}`,
      `Bid: ${b.url}`,
      b.pageUrl !== b.url ? `Board's procurement page: ${b.pageUrl}` : null,
    ].filter(Boolean).join('\n'),
  }
}

export function winNote(w: { competitor: string; buyer: string; kind: 'CONTRACT' | 'GRANT'; description: string | null; amount: number; startDate: Date | null; endDate: Date | null; url: string }, now: Date): { subject: string; body: string } {
  const e = awardEligibility(w.kind)
  const follow = w.endDate && w.endDate.getTime() > now.getTime() ? `Likely re-bid around ${day(w.endDate)} (contract end date)` : w.endDate ? `Ended ${day(w.endDate)}` : 'No end date on the award'
  return {
    subject: `Won: ${(w.description ?? 'federal award').replace(/\s+/g, ' ').slice(0, 140)}`,
    body: [
      `Competitor: ${w.competitor}`,
      `From: ${w.buyer}`,
      `Size: ${money(w.amount)} (${w.kind === 'GRANT' ? 'grant' : 'contract'})`,
      w.startDate ? `Started: ${day(w.startDate)}` : null,
      follow,
      `Could we bid next time: ${e.note}`,
      `Award record: ${w.url}`,
    ].filter(Boolean).join('\n'),
  }
}

export interface Ref { label: string; url: string; detail?: string }

export interface CrossRefs {
  /** For a board bid id: competitor wins that read like it. */
  winsForBid: Record<string, Ref[]>
  /** For a competitor award id: open bids (board and federal) that read like it, with their due dates. */
  bidsForAward: Record<string, Ref[]>
}

/**
 * Links both ways between what competitors won and what is open now, by shared wording in the descriptions. Only
 * awards that are not finished (or are recent) are worth comparing to open bids, so the caller passes those it will show.
 */
export function crossRefs(
  awards: { id: string; description: string | null; competitorName: string; amount: number; url: string }[],
  bids: { id: string; title: string; boardName: string; state: string; url: string; deadline: Date | null }[],
  opps: { id: string; title: string; agency: string; url: string; closesAt: Date | null }[],
  perItem = 3,
): CrossRefs {
  const wordsOf = (t: string) => words(t)
  const aw = awards.map((a) => ({ a, w: wordsOf(a.description ?? '') }))
  const items = [
    ...bids.map((b) => ({ key: `bid:${b.id}`, w: wordsOf(b.title), ref: { label: `${b.title} (${b.boardName}, ${b.state})`, url: b.url, detail: b.deadline ? `due ${day(b.deadline)}` : 'no deadline listed' } as Ref })),
    ...opps.map((o) => ({ key: `opp:${o.id}`, w: wordsOf(o.title), ref: { label: `${o.title} (${o.agency})`, url: o.url, detail: o.closesAt ? `closes ${day(o.closesAt)}` : 'no close date' } as Ref })),
  ]
  const overlap = (x: Set<string>, y: Set<string>) => { let n = 0; for (const w of x) if (y.has(w)) n++; return n }
  const out: CrossRefs = { winsForBid: {}, bidsForAward: {} }
  const winCandidates: Record<string, { n: number; ref: Ref }[]> = {}
  for (const { a, w } of aw) {
    const hits: { n: number; ref: Ref }[] = []
    for (const it of items) {
      const n = overlap(w, it.w)
      if (n < 2) continue
      hits.push({ n, ref: it.ref })
      if (it.key.startsWith('bid:')) (winCandidates[it.key.slice(4)] ??= []).push({ n, ref: { label: `${a.competitorName}: ${(a.description ?? 'award').slice(0, 90)}`, url: a.url, detail: money(a.amount) } })
    }
    if (hits.length) out.bidsForAward[a.id] = hits.sort((x, y) => y.n - x.n).slice(0, perItem).map((h) => h.ref)
  }
  for (const [id, list] of Object.entries(winCandidates)) out.winsForBid[id] = list.sort((x, y) => y.n - x.n).slice(0, perItem).map((h) => h.ref)
  return out
}
