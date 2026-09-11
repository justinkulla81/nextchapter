/**
 * Finding a new date on a funder's page.
 *
 * The Phase 2 import measured why this matters: 241 of 252 deadline cells in
 * the funding sheet hold prose rather than a date, and all 9 real dates have
 * already passed. For most of these records, finding a date IS the work.
 *
 * This extractor is deliberately heuristic and model-free. A page fetch costs
 * nothing per use; a model call would make the feature metered, and the flag
 * has always been that anything scaling with usage gets named before it ships.
 * The heuristic finds candidates and shows the sentence each came from — the
 * human reads the context and decides. An LLM pass could be layered on later
 * as an explicit, priced opt-in, but nothing here needs one.
 */

export interface DateCandidate {
  /** Midnight UTC on the matched day. */
  date: Date
  /** The text it was read from, so you can judge rather than trust. */
  snippet: string
  /** Higher when the surrounding words suggest an actual deadline. */
  confidence: number
  matched: string
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/** Words that make a nearby date likely to BE the deadline rather than incidental. */
const STRONG = /\b(deadline|due|closes?|closing|last day|final day|submit by|apply by|applications? (?:close|due|open)|cohort|batch|round|window)\b/i
const WEAK = /\b(apply|application|program|cycle|announce|notification|open)\b/i
/** Words that mean the date is about something else entirely. */
const NEGATIVE = /\b(copyright|privacy|updated|posted|published|founded|since|©)\b/i

/** Strips tags, script/style bodies and entities. Good enough to read prose from. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim()
}

function snippetAround(text: string, index: number, length: number, radius: number): string {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

const DISPLAY_RADIUS = 90

/** Every index at which a pattern matches, so proximity can be measured. */
function positionsOf(text: string, re: RegExp): number[] {
  const out: number[] = []
  for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
    if (m.index !== undefined) out.push(m.index)
  }
  return out
}

function nearest(positions: number[], index: number): number {
  let best = Infinity
  for (const p of positions) best = Math.min(best, Math.abs(p - index))
  return best
}

/**
 * Confidence is decided by which kind of word sits CLOSEST to the date, not by
 * which words appear in a window around it.
 *
 * A window gets this wrong on any page where both kinds appear in one
 * sentence: "Page last updated March 2. The application deadline is November 4"
 * put "deadline" inside both dates' windows, so the incidental date scored the
 * same as the real one and won on tie-break. Distance separates them cleanly.
 */
function scoreAt(index: number, strong: number[], weak: number[], negative: number[]): number {
  const ds = nearest(strong, index)
  const dn = nearest(negative, index)
  const dw = nearest(weak, index)
  const NEAR = 120

  if (ds < dn && ds <= NEAR) return 0.9
  if (dn < ds && dn <= NEAR) return 0.2
  if (dw <= NEAR) return 0.5
  return 0.3
}

/**
 * Pulls plausible dates out of page text.
 *
 * Only future-or-recent dates are returned — a page mentioning 2019 is not
 * announcing a new window — and results are deduped by day, keeping the
 * highest-confidence mention of each.
 */
export function extractDateCandidates(text: string, now: Date = new Date()): DateCandidate[] {
  const found = new Map<string, DateCandidate>()
  const strongAt = positionsOf(text, STRONG)
  const weakAt = positionsOf(text, WEAK)
  const negativeAt = positionsOf(text, NEGATIVE)
  const add = (date: Date, index: number, matchLength: number, matched: string) => {
    if (Number.isNaN(date.getTime())) return
    // Ignore anything more than a year in the past or three years ahead.
    const ageDays = (now.getTime() - date.getTime()) / 86_400_000
    if (ageDays > 365 || ageDays < -1095) return
    const snippet = snippetAround(text, index, matchLength, DISPLAY_RADIUS)
    const confidence = scoreAt(index, strongAt, weakAt, negativeAt)
    const cand: DateCandidate = { date, snippet, confidence, matched }
    const key = date.toISOString().slice(0, 10)
    const prev = found.get(key)
    if (!prev || cand.confidence > prev.confidence) found.set(key, cand)
  }

  // 2026-11-04
  for (const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    add(new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`), m.index ?? 0, m[0].length, m[0])
  }
  // November 4, 2026 · Nov 4 2026 · 4 November 2026
  for (const m of text.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/gi)) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()]
    add(new Date(Date.UTC(Number(m[3]), mon, Number(m[2]))), m.index ?? 0, m[0].length, m[0])
  }
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+(20\d{2})\b/gi)) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()]
    add(new Date(Date.UTC(Number(m[3]), mon, Number(m[1]))), m.index ?? 0, m[0].length, m[0])
  }
  // 11/04/2026 — assumed US order, which is why the snippet is always shown.
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g)) {
    add(new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]))), m.index ?? 0, m[0].length, m[0])
  }

  return [...found.values()].sort(
    (a, b) => b.confidence - a.confidence || a.date.getTime() - b.date.getTime()
  )
}
