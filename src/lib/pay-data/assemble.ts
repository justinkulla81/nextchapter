import { PAY_LEVELS, type PayGroup, type PayLevel, type PayStat, type SkillPay } from './types'

// Pure assembly and the guards that decide what is published (the SQL is in compute.ts). Tested in src/test/pay-data.test.ts.
//
// A group is shown only with MIN_GROUP postings from MIN_GROUP_COMPANIES employers. A skill is shown only with MIN_SKILL postings from
// MIN_SKILL_COMPANIES employers, none of them more than MAX_COMPANY_SHARE of the skill's postings: one employer listing "Asana" on
// hundreds of roles must not read as "Asana pays 51% more" (the 2026-11-03 probe).

export const MIN_GROUP = 30
export const MIN_GROUP_COMPANIES = 8
export const MIN_SKILL = 100
export const MIN_SKILL_COMPANIES = 15
export const MAX_COMPANY_SHARE = 0.25
export const MIN_LIKE_N = 150
export const MIN_LIKE_CELLS = 5
/** A like-for-like gap under this many percent, either way, is worded as no clear gap (see paysMore, paysLess). */
export const MIN_GAP_PCT = 2

const r500 = (x: number) => Math.round(x / 500) * 500
const round1 = (x: number) => Math.round(x * 10) / 10

export interface RawStat {
  n: number
  companies: number
  p25: number
  p50: number
  p75: number
}

export function statOf(r: RawStat): PayStat {
  return { n: r.n, companies: r.companies, p25: r500(r.p25), p50: r500(r.p50), p75: r500(r.p75) }
}

export const groupHasEnough = (r: { n: number; companies: number }) => r.n >= MIN_GROUP && r.companies >= MIN_GROUP_COMPANIES

export interface RawGroupRow extends RawStat {
  key: string
  lvl: string | null
}

export interface RawLikeRow {
  key: string
  likePct: number
  likeUsd: number
  likeN: number
  likeCells: number
}

/** Turns rows of (group, level) stats into groups with a level split. `lvl = null` rows are the group totals. */
export function buildGroups(rows: RawGroupRow[], label: (key: string) => string | null, order: 'median' | 'name' = 'median', like: RawLikeRow[] = []): PayGroup[] {
  const groups = new Map<string, PayGroup>()
  for (const r of rows) {
    if (r.lvl !== null || !groupHasEnough(r)) continue
    const name = label(r.key)
    if (!name) continue
    groups.set(r.key, { key: r.key, label: name, ...statOf(r) })
  }
  for (const l of like) {
    const g = groups.get(l.key)
    if (!g || l.likeN < MIN_LIKE_N || l.likeCells < MIN_LIKE_CELLS) continue
    g.likePct = round1(l.likePct)
    g.likeUsd = r500(l.likeUsd)
    g.likeN = l.likeN
    g.likeCells = l.likeCells
  }
  for (const r of rows) {
    if (r.lvl === null || !groupHasEnough(r) || !(PAY_LEVELS as readonly string[]).includes(r.lvl)) continue
    const g = groups.get(r.key)
    if (!g) continue
    ;(g.levels ??= {})[r.lvl as PayLevel] = statOf(r)
  }
  const out = [...groups.values()]
  return order === 'median' ? out.sort((a, b) => b.p50 - a.p50) : out.sort((a, b) => a.label.localeCompare(b.label))
}

export interface RawSkillRow extends RawStat {
  skill: string
  /** Postings of the single employer that lists the skill most. */
  topCompanyN: number
  baseP50: number
  likePct: number | null
  likeUsd: number | null
  likeN: number | null
  likeCells: number | null
}

export function skillPassesGuards(r: Pick<RawSkillRow, 'n' | 'companies' | 'topCompanyN'>): boolean {
  return r.n >= MIN_SKILL && r.companies >= MIN_SKILL_COMPANIES && r.topCompanyN / r.n <= MAX_COMPANY_SHARE
}

export function buildSkills(rows: RawSkillRow[], topFunctions: Map<string, { label: string; n: number }[]>): SkillPay[] {
  const out: SkillPay[] = []
  for (const r of rows) {
    if (!skillPassesGuards(r) || r.baseP50 <= 0) continue
    const s: SkillPay = {
      skill: r.skill,
      ...statOf(r),
      baseP50: r500(r.baseP50),
      rawPct: round1(100 * (r.p50 / r.baseP50 - 1)),
      topFunctions: topFunctions.get(r.skill) ?? [],
    }
    if (r.likePct !== null && r.likeN !== null && r.likeCells !== null && r.likeN >= MIN_LIKE_N && r.likeCells >= MIN_LIKE_CELLS) {
      s.likePct = round1(r.likePct)
      s.likeUsd = r500(r.likeUsd ?? 0)
      s.likeN = r.likeN
      s.likeCells = r.likeCells
    }
    out.push(s)
  }
  // Like-for-like first (the figure that controls for role), skills without one after them by overall pay.
  return out.sort((a, b) => (b.likePct ?? -Infinity) - (a.likePct ?? -Infinity) || b.p50 - a.p50)
}

/** True when the like-for-like gap is large enough to word as "pays more" (and not noise around zero). */
export const paysMore = (s: SkillPay) => (s.likePct ?? 0) >= MIN_GAP_PCT
export const paysLess = (s: SkillPay) => (s.likePct ?? 0) <= -MIN_GAP_PCT

/** URL slug of a skill: lowercase, letters and digits, other runs to one hyphen ("c++" -> "c-plus-plus", "m&a" -> "m-and-a"). */
export function skillSlug(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/&/g, ' and ')
    .replace(/#/g, ' sharp ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
