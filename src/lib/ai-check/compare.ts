import occupations from './occupations.json'
import pairs from './compare-pairs.json'
import { checkSlug, socFromSlug } from './slug'
import { BAND_LABEL, bandOf, scorePercent } from '@/lib/skills/ai-exposure'

// Comparison pages: "Accountants and Auditors vs Financial and Investment Analysts". Pairs come from the committed list
// compare-pairs.json (built by scripts/ai-check/build-compare-pairs.ts from the related-occupation similarity), so the
// sitemap and the route never read the database to know which pages exist. Pure here, tested in src/test/ai-check-compare.test.ts.

const TITLE = new Map(occupations.map((o) => [o.soc, o.title]))
const PAIR_KEYS = new Set((pairs as string[][]).map(([a, b]) => `${a}|${b}`))

/** Both codes in the order the list keeps them (lower first), or null when the pair is not on the list. */
export function listedPair(a: string, b: string): [string, string] | null {
  const [lo, hi] = a < b ? [a, b] : [b, a]
  return PAIR_KEYS.has(`${lo}|${hi}`) ? [lo, hi] : null
}

export const titleOf = (soc6: string): string | null => TITLE.get(soc6) ?? null

export function comparePath(a: string, b: string): string | null {
  const ta = titleOf(a)
  const tb = titleOf(b)
  const p = listedPair(a, b)
  if (!ta || !tb || !p) return null
  const [lo, hi] = p
  return `/tools/ai-job-check/compare/${checkSlug(titleOf(lo)!, lo)}-vs-${checkSlug(titleOf(hi)!, hi)}`
}

export const COMPARE_PATHS: string[] = (pairs as string[][]).flatMap(([a, b]) => comparePath(a, b) ?? [])

/** The two SOC codes in a pair slug, or null when the slug is not two check slugs joined by "-vs-". */
export function pairFromSlug(slug: string): [string, string] | null {
  const m = /^(.+-\d{2}-\d{4})-vs-(.+-\d{2}-\d{4})$/.exec(slug)
  if (!m) return null
  const a = socFromSlug(m[1])
  const b = socFromSlug(m[2])
  return a && b ? [a, b] : null
}

/** Other pairs that include this job, for the "also compared" links on an occupation's comparison pages. */
export function pairsWith(soc6: string): string[] {
  return (pairs as string[][]).filter(([a, b]) => a === soc6 || b === soc6).map(([a, b]) => (a === soc6 ? b : a))
}

export interface Figures {
  soc6: string
  title: string
  score: number
  medianWage: number | null
  growthPct: number | null
  annualOpenings: number | null
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const lower = (s: string) => s.toLowerCase()

/** One paragraph that reads the table back using only its numbers. Never "risk", "safe" or "will". */
export function readingOf(a: Figures, b: Figures): string {
  const parts: string[] = []
  const pa = Math.round(a.score * 100)
  const pb = Math.round(b.score * 100)
  if (pa === pb) {
    parts.push(`AI is used for the same share of tasks in both jobs: ${scorePercent(a.score)}.`)
  } else {
    const [hi, lo] = pa > pb ? [a, b] : [b, a]
    parts.push(
      `AI use is higher in ${lower(hi.title)} work: ${scorePercent(hi.score)} of tasks (${BAND_LABEL[bandOf(hi.score)].toLowerCase()}) against ${scorePercent(lo.score)} for ${lower(lo.title)} (${BAND_LABEL[bandOf(lo.score)].toLowerCase()}).`,
    )
  }
  if (a.medianWage && b.medianWage && a.medianWage !== b.medianWage) {
    const [hi, lo] = a.medianWage > b.medianWage ? [a, b] : [b, a]
    parts.push(`${hi.title} has the higher median pay, ${usd(hi.medianWage!)} a year against ${usd(lo.medianWage!)}, a gap of ${usd(hi.medianWage! - lo.medianWage!)}.`)
  }
  if (a.annualOpenings && b.annualOpenings && a.annualOpenings !== b.annualOpenings) {
    const [hi, lo] = a.annualOpenings > b.annualOpenings ? [a, b] : [b, a]
    parts.push(`${hi.title} has more openings a year, ${hi.annualOpenings!.toLocaleString('en-US')} against ${lo.annualOpenings!.toLocaleString('en-US')}.`)
  }
  return parts.join(' ')
}
