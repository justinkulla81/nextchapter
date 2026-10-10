import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { isPlausibleAnnualRange } from '@/lib/companies/pay-ranges'

// What our own board shows: do postings in a function that ask for AI skills advertise
// higher pay than the same function and level without them? Pure — no database — and
// tested in src/test/ai-pay-premium.test.ts.
//
// What this is NOT: realized pay, or proof that learning AI causes a raise. It compares
// advertised ranges, and AI-asking postings skew toward bigger employers and senior,
// technical work, so the comparison is made WITHIN level to remove the biggest of those.
// A function with too few postings on either side shows no number rather than a noisy one.

export const MIN_POSTINGS_PER_SIDE = 5
const MIN_LEVEL_STRATUM = 2

export interface PremiumPosting {
  title: string
  description: string | null
  skills: string[]
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
}

export interface FunctionPremium {
  function: string
  withAi: number
  withoutAi: number
  /** Level-adjusted % difference in median advertised midpoint, or null when too thin. */
  premiumPct: number | null
  medianWithAi: number | null
  medianWithoutAi: number | null
}

// Specific enough to avoid "ai" inside other words and "AI" as a name. Matched on word
// boundaries against title, description excerpt and extracted skills.
const AI_PATTERNS: RegExp[] = [
  /\bartificial intelligence\b/i,
  /\bmachine learning\b/i,
  /\bgenerative ai\b/i,
  /\bgen ?ai\b/i,
  /\bllms?\b/i,
  /\blarge language models?\b/i,
  /\bchatgpt\b/i,
  /\bcopilot\b/i,
  /\bprompt engineering\b/i,
  /\bai[- ](powered|driven|enabled|tools?|agents?|strategy|automation|initiatives?)\b/i,
  /\b(use|using|leverag\w+|apply\w*|experience (with|in)|knowledge of|familiarity with) ai\b/i,
  /\bai\/ml\b/i,
]

export function mentionsAiSkill(p: Pick<PremiumPosting, 'title' | 'description' | 'skills'>): boolean {
  const text = `${p.title}\n${p.description ?? ''}\n${p.skills.join(' ')}`
  return AI_PATTERNS.some((re) => re.test(text))
}

const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function computeAiPayPremium(postings: PremiumPosting[]): FunctionPremium[] {
  type Bucket = { ai: number[]; non: number[] }
  const byFn = new Map<string, Map<string, Bucket>>()

  for (const p of postings) {
    if (!isPlausibleAnnualRange(p)) continue
    const fn = inferFunctionFromTitle(p.title)
    if (!fn) continue
    const level = inferLevelFromTitle(p.title)
    const mid = (p.salaryMin! + p.salaryMax!) / 2
    const levels = byFn.get(fn) ?? new Map<string, Bucket>()
    const b = levels.get(level) ?? { ai: [], non: [] }
    ;(mentionsAiSkill(p) ? b.ai : b.non).push(mid)
    levels.set(level, b)
    byFn.set(fn, levels)
  }

  const rows: FunctionPremium[] = []
  for (const [fn, levels] of byFn) {
    const all = [...levels.values()]
    const ai = all.flatMap((b) => b.ai)
    const non = all.flatMap((b) => b.non)

    let premiumPct: number | null = null
    if (ai.length >= MIN_POSTINGS_PER_SIDE && non.length >= MIN_POSTINGS_PER_SIDE) {
      // Level-adjusted: compare inside each level that has both sides, weight by the
      // smaller side so a level with 2 and 2 does not count like one with 40 and 40.
      let weighted = 0
      let weight = 0
      for (const b of all) {
        if (b.ai.length < MIN_LEVEL_STRATUM || b.non.length < MIN_LEVEL_STRATUM) continue
        const w = Math.min(b.ai.length, b.non.length)
        weighted += w * (median(b.ai) / median(b.non) - 1)
        weight += w
      }
      if (weight >= MIN_POSTINGS_PER_SIDE) premiumPct = Math.round((weighted / weight) * 100)
    }

    rows.push({
      function: fn,
      withAi: ai.length,
      withoutAi: non.length,
      premiumPct,
      medianWithAi: ai.length ? Math.round(median(ai)) : null,
      medianWithoutAi: non.length ? Math.round(median(non)) : null,
    })
  }
  return rows.sort((a, b) => b.withAi + b.withoutAi - (a.withAi + a.withoutAi))
}
