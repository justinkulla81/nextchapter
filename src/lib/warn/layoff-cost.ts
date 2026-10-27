/**
 * What a layoff costs the employer, and who is running the outplacement, read
 * from the filing text. Pure, so it is testable without a database. A WARN
 * filing or a news story rarely says either, so "not disclosed" is the normal
 * answer outside an SEC 8-K, and nothing here ever guesses a number.
 */
export interface LayoffCost {
  lowUsd: number
  highUsd: number
  /** What the money is for, in the filing's words: "employee termination costs", "restructuring charges". */
  note: string
}

export interface Outplacement {
  /** The vendor, when the text names one. */
  provider: string | null
  /** One line for the email and the CRM. */
  note: string
}

const UNIT: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9, k: 1e3, m: 1e6, mm: 1e6, b: 1e9, bn: 1e9 }
const AMOUNT = String.raw`\$\s?(\d[\d,]*(?:\.\d+)?)\s*(thousand|million|billion|mm|bn|k|m|b)?\b`
const RANGE = new RegExp(`${AMOUNT}(?:\\s*(?:to|and|-|–|—|through)\\s*${AMOUNT.replace(/\(/g, '(')})?`, 'gi')

const toUsd = (n: string, unit: string | undefined, fallbackUnit?: string): number => {
  const mult = UNIT[(unit ?? fallbackUnit ?? '').toLowerCase()] ?? 1
  return parseFloat(n.replace(/,/g, '')) * mult
}

const COST_WORDS = /\b(costs?|charges?|expenses?)\b/i
const PEOPLE_WORDS = /\b(severance|termination|employee|workforce|headcount|reduction in force|separation|retention)\b/i
const TOTAL_WORDS = /\b(total|aggregate|in total|overall)\b/i

/** Every dollar figure or range in a sentence, as low/high in dollars. */
function amountsIn(sentence: string): { low: number; high: number; end: number }[] {
  const out: { low: number; high: number; end: number }[] = []
  for (const m of sentence.matchAll(RANGE)) {
    const unitA = m[2], unitB = m[4]
    const a = toUsd(m[1], unitA, unitB)
    const b = m[3] ? toUsd(m[3], unitB, unitA) : a
    const low = Math.min(a, b), high = Math.max(a, b)
    if (low >= 10_000) out.push({ low, high, end: (m.index ?? 0) + m[0].length })
  }
  return out
}

function noteFor(sentence: string): string {
  const s = sentence.toLowerCase()
  if (/severance/.test(s) && /termination/.test(s)) return 'severance and employee termination costs'
  if (/termination/.test(s)) return 'employee termination costs'
  if (/severance/.test(s)) return 'severance costs'
  if (/restructuring/.test(s)) return 'restructuring charges'
  return 'workforce reduction costs'
}

/**
 * The cost the filing gives for the people side of a layoff. Prefers the
 * sentence that names severance or termination costs; falls back to a total
 * restructuring charge. Returns null when no dollar amount sits beside a cost.
 */
export function readLayoffCost(text: string): LayoffCost | null {
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.;])\s+(?=[A-Z(])/)
  const hits = sentences
    .filter((s) => COST_WORDS.test(s) && PEOPLE_WORDS.test(s))
    .map((s) => ({ s, amounts: amountsIn(s) }))
    .filter((h) => h.amounts.length)
  if (!hits.length) return null
  const people = hits.find((h) => /severance|termination|separation/i.test(h.s)) ?? hits.find((h) => TOTAL_WORDS.test(h.s)) ?? hits[0]
  // A sentence with several figures ("total $40M, of which $12M-$17M is severance"): the people figure is the one the severance or termination words follow.
  const PEOPLE_TAIL = /^.{0,25}?(severance|termination|separation)/i
  const pick = people.amounts.find((a) => PEOPLE_TAIL.test(people.s.slice(a.end))) ?? people.amounts[0]
  const tail = people.s.slice(pick.end, pick.end + 45)
  return { lowUsd: pick.low, highUsd: pick.high, note: noteFor(tail) }
}

const VENDORS: [RegExp, string][] = [
  [/\blee hecht harrison\b|\bLHH\b/i, 'LHH (Lee Hecht Harrison)'],
  [/\brisesmart\b/i, 'Randstad RiseSmart'],
  [/\bright management\b/i, 'Right Management'],
  [/\bkorn ferry\b/i, 'Korn Ferry'],
  [/\bchallenger,? gray\b/i, 'Challenger, Gray & Christmas'],
  [/\bcareerminds\b/i, 'CareerMinds'],
  [/\bcareer transition (?:partners|group)\b/i, 'Career Transition Partners'],
  [/\bcareerarc\b/i, 'CareerArc'],
  [/\bmanpowergroup\b/i, 'ManpowerGroup Right Management'],
  [/\bnewleaf\b|\bnew leaf\b/i, 'NewLeaf'],
]

/** Whether outplacement is mentioned, and the vendor when the text names one near it. */
export function readOutplacement(text: string): Outplacement | null {
  const flat = text.replace(/\s+/g, ' ')
  if (!/outplacement|career transition (?:services|support|assistance)/i.test(flat)) return null
  const near = flat.split(/(?<=[.;])\s+/).filter((s) => /outplacement|career transition/i.test(s)).join(' ')
  const vendor = VENDORS.find(([re]) => re.test(near))?.[1] ?? null
  return {
    provider: vendor,
    note: vendor ? `Outplacement: ${vendor}` : 'Outplacement support is part of the package; the vendor is not named',
  }
}

/** "$12M–$17M", "$4.5M", "$850K". */
export function formatUsd(low: number | null | undefined, high?: number | null): string | null {
  if (low == null) return null
  const one = (n: number) => {
    if (n >= 1e9) return `$${+(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `$${+(n / 1e6).toFixed(1)}M`
    return `$${Math.round(n / 1e3).toLocaleString('en-US')}K`
  }
  return high != null && high !== low ? `${one(low)}–${one(high)}` : one(low)
}

export interface CostFields {
  costLowUsd: number | null
  costHighUsd: number | null
  costNote: string | null
  outplacementProvider: string | null
  outplacementNote: string | null
}

/** The two lines every layoff view shows. Cost always; outplacement only once there is something to say. */
export function costLines(n: Partial<CostFields>): { cost: string; outplacement: string | null } {
  const range = formatUsd(n.costLowUsd, n.costHighUsd)
  return {
    cost: range ? `${range}${n.costNote ? ` ${n.costNote}` : ''}` : 'Cost not disclosed',
    outplacement: n.outplacementProvider ? `Outplacement: ${n.outplacementProvider}` : n.outplacementNote ?? null,
  }
}

/** Everything read from one filing's text, ready to store on the notice. */
export function readFilingCosts(text: string): CostFields {
  const c = readLayoffCost(text), o = readOutplacement(text)
  return {
    costLowUsd: c?.lowUsd ?? null, costHighUsd: c?.highUsd ?? null, costNote: c?.note ?? null,
    outplacementProvider: o?.provider ?? null, outplacementNote: o?.note ?? null,
  }
}
