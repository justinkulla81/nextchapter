// Occupation-to-occupation similarity across every O*NET occupation, the backbone of the
// board's skills-adjacent matches (src/lib/jobs/search-breadth.ts). Built offline from the
// O*NET file the crawler already keeps (scripts/careers/build-occupation-similarity.ts) into
// the OccupationSimilarity table; at request time it is a lookup, never a model call.
//
// Pure: no database, so the rules are unit-tested.
//
// Score (0-1): how strongly two occupations' skill and knowledge profiles move together,
// centred on the mean across all occupations (otherwise everything scores ~0.9 against
// everything, as vectors.ts explains), lifted when O*NET itself lists the pair as related.
// An occupation O*NET has no ratings for ("All Other") is placed by its related list alone.

export interface OnetFileOccupation {
  title: string
  jobZone?: number | null
  skillVector?: Record<string, number> | null
  knowledge?: { name: string; importance: number }[] | null
  technology?: { name: string; hot?: boolean; inDemand?: boolean }[] | null
  related?: { code: string; tier: string; index: number }[] | null
}

export interface SimilarityRow {
  socCode: string
  similarSocCode: string
  /** 0-1, higher is closer. */
  score: number
  /** O*NET lists the pair as related (Primary-Short / Primary-Long tiers). */
  related: boolean
  /** What the two have in common: distinctive shared knowledge, then skills, then a rare shared tool. */
  sharedSkills: string[]
  title: string
  similarTitle: string
}

/** Lift for a pair O*NET itself relates, by tier. */
export const RELATED_LIFT: Record<string, number> = { 'Primary-Short': 0.12, 'Primary-Long': 0.06 }
/** Where an occupation has no ratings, its related list alone places it (score by tier). */
export const RELATED_ONLY_SCORE: Record<string, number> = { 'Primary-Short': 0.82, 'Primary-Long': 0.74 }
/** Pairs kept per occupation, and the lowest score worth storing. */
export const MAX_SIMILAR = 40
export const MIN_STORED_SCORE = 0.55

/** Knowledge an occupation does not list in its top ten is taken as this (1-5 scale). */
const UNLISTED_KNOWLEDGE = 2
const UNINFORMATIVE = new Set(['English Language', 'Reading Comprehension', 'Active Listening', 'Speaking', 'Writing', 'Critical Thinking'])
/** Office basics every candidate has; never named as a shared skill. */
const BASIC_TOOLS = /^(microsoft (word|outlook|excel|powerpoint|teams|office|windows|edge|365)|google (docs|sheets|meet|drive|workspace)|adobe acrobat|apple macos|zoom|slack|web browser|email)\b/i

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

function rated(o: OnetFileOccupation): boolean {
  return !!o.skillVector && Object.keys(o.skillVector).length >= 10
}

/** Every occupation's centred, unit-length vector over skills (all 35) and knowledge (top ten listed). */
export function buildVectors(occ: Record<string, OnetFileOccupation>): Map<string, Float64Array> {
  const dims = new Map<string, number>()
  for (const o of Object.values(occ)) {
    if (!rated(o)) continue
    for (const k of Object.keys(o.skillVector!)) if (!dims.has(`s:${k}`)) dims.set(`s:${k}`, dims.size)
    for (const k of o.knowledge ?? []) if (!dims.has(`k:${k.name}`)) dims.set(`k:${k.name}`, dims.size)
  }
  const raw = new Map<string, Float64Array>()
  const mean = new Float64Array(dims.size)
  for (const [soc, o] of Object.entries(occ)) {
    if (!rated(o)) continue
    const v = new Float64Array(dims.size)
    for (const [k, i] of dims) if (k.startsWith('k:')) v[i] = UNLISTED_KNOWLEDGE
    for (const [k, x] of Object.entries(o.skillVector!)) v[dims.get(`s:${k}`)!] = x
    for (const k of o.knowledge ?? []) v[dims.get(`k:${k.name}`)!] = k.importance
    raw.set(soc, v)
    for (let i = 0; i < v.length; i++) mean[i] += v[i]
  }
  for (let i = 0; i < mean.length; i++) mean[i] /= Math.max(raw.size, 1)
  for (const v of raw.values()) {
    let norm = 0
    for (let i = 0; i < v.length; i++) {
      v[i] -= mean[i]
      norm += v[i] * v[i]
    }
    norm = Math.sqrt(norm)
    if (norm > 0) for (let i = 0; i < v.length; i++) v[i] /= norm
  }
  return raw
}

function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

/** A tool listed for more than this share of occupations (Photoshop, SPSS) says nothing about a pair. */
export const MAX_TOOL_SHARE = 0.06

/** Share of occupations that list each tool. */
function toolShares(occ: Record<string, OnetFileOccupation>): Map<string, number> {
  const n = new Map<string, number>()
  const all = Object.values(occ)
  for (const o of all) for (const name of new Set((o.technology ?? []).map((t) => t.name))) n.set(name, (n.get(name) ?? 0) + 1)
  return new Map([...n].map(([k, c]) => [k, c / Math.max(all.length, 1)]))
}

/** Mean importance of each skill across occupations, so "shared" means shared and distinctive. */
function skillMeans(occ: Record<string, OnetFileOccupation>): Map<string, number> {
  const sum = new Map<string, [number, number]>()
  for (const o of Object.values(occ)) {
    for (const [k, v] of Object.entries(o.skillVector ?? {})) {
      const s = sum.get(k) ?? [0, 0]
      sum.set(k, [s[0] + v, s[1] + 1])
    }
  }
  return new Map([...sum].map(([k, [s, n]]) => [k, s / n]))
}

/** What two occupations have in common, in plain words: distinctive knowledge, then skills, then one rare shared tool. */
export function sharedSkillsOf(a: OnetFileOccupation, b: OnetFileOccupation, means: Map<string, number>, n = 3, toolShare: Map<string, number> = new Map()): string[] {
  const bTools = new Set((b.technology ?? []).map((t) => t.name))
  const tools = (a.technology ?? [])
    .filter((t) => (t.hot || t.inDemand) && bTools.has(t.name) && !BASIC_TOOLS.test(t.name) && (toolShare.get(t.name) ?? 0) <= MAX_TOOL_SHARE)
    .map((t) => t.name.replace(/\s+software$/i, ''))
  const bKnow = new Map((b.knowledge ?? []).map((k) => [k.name, k.importance]))
  const knowledge = (a.knowledge ?? [])
    .filter((k) => !UNINFORMATIVE.has(k.name) && k.importance >= 3.5 && (bKnow.get(k.name) ?? 0) >= 3.5)
    .sort((x, y) => Math.min(y.importance, bKnow.get(y.name)!) - Math.min(x.importance, bKnow.get(x.name)!))
    .map((k) => sentence(k.name))
  const av = a.skillVector ?? {}
  const bv = b.skillVector ?? {}
  const skills = Object.keys(av)
    .filter((k) => k in bv && !UNINFORMATIVE.has(k))
    .map((k) => ({ k, lift: Math.min(av[k], bv[k]) - (means.get(k) ?? 0) }))
    .filter((x) => x.lift >= 0.25)
    .sort((x, y) => y.lift - x.lift || x.k.localeCompare(y.k))
    .map((x) => sentence(x.k))
  // Shared tools only when they are rare (MAX_TOOL_SHARE) and only as a tiebreak after
  // knowledge and skills: O*NET's tool lists are long and noisy ("AWS" for general managers).
  return [...new Set([...knowledge, ...skills, ...tools.slice(0, 1)])].slice(0, n)
}

const round = (x: number) => Math.round(x * 1000) / 1000

/**
 * The similarity rows for every occupation: its closest MAX_SIMILAR others at or above
 * MIN_STORED_SCORE. Not symmetric by construction (each side keeps its own top list), but the
 * score of a pair is the same from either side.
 */
export function buildSimilarityRows(occ: Record<string, OnetFileOccupation>): SimilarityRow[] {
  const vectors = buildVectors(occ)
  const means = skillMeans(occ)
  const shares = toolShares(occ)
  const rows: SimilarityRow[] = []
  const socs = Object.keys(occ).sort()
  for (const a of socs) {
    const oa = occ[a]
    const relatedTier = new Map<string, string>()
    for (const r of oa.related ?? []) if (r.tier.startsWith('Primary')) relatedTier.set(r.code, r.tier)
    // Related works both ways: B listing A counts as much as A listing B.
    for (const b of socs) {
      if (b === a || relatedTier.has(b)) continue
      const tier = (occ[b].related ?? []).find((r) => r.code === a && r.tier.startsWith('Primary'))?.tier
      if (tier) relatedTier.set(b, tier)
    }
    const va = vectors.get(a)
    const scored: SimilarityRow[] = []
    for (const b of socs) {
      if (b === a) continue
      const vb = vectors.get(b)
      const tier = relatedTier.get(b)
      let score: number
      if (va && vb) score = Math.min(1, cosine(va, vb) + (tier ? (RELATED_LIFT[tier] ?? 0) : 0))
      else if (tier) score = RELATED_ONLY_SCORE[tier] ?? 0
      else continue
      if (score < MIN_STORED_SCORE) continue
      scored.push({ socCode: a, similarSocCode: b, score: round(score), related: !!tier, sharedSkills: [], title: oa.title, similarTitle: occ[b].title })
    }
    scored.sort((x, y) => y.score - x.score || x.similarSocCode.localeCompare(y.similarSocCode))
    for (const r of scored.slice(0, MAX_SIMILAR)) {
      r.sharedSkills = sharedSkillsOf(oa, occ[r.similarSocCode], means, 3, shares)
      rows.push(r)
    }
  }
  return rows
}
