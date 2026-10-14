import type { ElementKind, OccupationElement, OccupationProfile } from '@/lib/careers/types'

/**
 * Skill similarity between occupations.
 *
 * Plain cosine over O*NET ratings is useless: nearly every occupation rates
 * reading comprehension and critical thinking highly, so everything looks
 * 0.9 similar to everything. We centre each element on its mean across all
 * occupations first (so only what is distinctive about an occupation counts),
 * then take the cosine of those centred vectors.
 *
 * Only SKILL and KNOWLEDGE elements are used. Technology rows are a list of
 * tools, not a rated scale, and are handled separately as concrete gaps.
 */
export interface VectorSpace {
  index: Map<string, number>
  vectors: Map<string, Float64Array>
}

const RATED = (e: OccupationElement) => e.kind !== 'TECHNOLOGY' && e.level !== null

// How much an occupation leans on an element: importance weighted by the level
// it needs (both 0-100), so a skill that matters AND is needed at a high level
// counts for more than one that is merely listed.
function strength(e: OccupationElement): number {
  return (e.importance * (e.level ?? 0)) / 100
}

export function buildVectorSpace(profiles: OccupationProfile[]): VectorSpace {
  const index = new Map<string, number>()
  for (const p of profiles) {
    for (const [id, e] of p.elements) if (RATED(e) && !index.has(id)) index.set(id, index.size)
  }
  const dim = index.size
  const means = new Float64Array(dim)
  const raw = new Map<string, Float64Array>()
  for (const p of profiles) {
    const v = new Float64Array(dim)
    for (const [id, e] of p.elements) {
      if (!RATED(e)) continue
      v[index.get(id)!] = strength(e)
    }
    raw.set(p.socCode, v)
    for (let i = 0; i < dim; i++) means[i] += v[i]
  }
  const n = Math.max(profiles.length, 1)
  for (let i = 0; i < dim; i++) means[i] /= n

  const vectors = new Map<string, Float64Array>()
  for (const [soc, v] of raw) {
    let norm = 0
    for (let i = 0; i < dim; i++) {
      v[i] -= means[i]
      norm += v[i] * v[i]
    }
    norm = Math.sqrt(norm)
    if (norm > 0) for (let i = 0; i < dim; i++) v[i] /= norm
    vectors.set(soc, v)
  }
  return { index, vectors }
}

/** Cosine of two centred vectors: -1..1, higher means more alike. */
export function similarity(space: VectorSpace, a: string, b: string): number | null {
  const va = space.vectors.get(a)
  const vb = space.vectors.get(b)
  if (!va || !vb) return null
  let dot = 0
  for (let i = 0; i < va.length; i++) dot += va[i] * vb[i]
  return dot
}

const REQUIRED_IMPORTANCE = 50

/**
 * Share of what the target role asks for that the source role already has,
 * weighted by how much each element matters. For every element the target
 * rates as important, the source gets credit for its own level relative to the
 * target's (capped at full credit).
 *
 * This describes the two occupations in general. It is not a test of the
 * person, so the UI words it as "skills in common".
 */
export function skillOverlap(source: OccupationProfile, target: OccupationProfile): number | null {
  let have = 0
  let total = 0
  for (const [id, t] of target.elements) {
    if (!RATED(t) || t.importance < REQUIRED_IMPORTANCE) continue
    const need = t.level ?? 0
    const s = source.elements.get(id)
    const credit = need <= 0 ? 1 : Math.min(1, ((s && RATED(s) ? s.level ?? 0 : 0) / need))
    have += t.importance * credit
    total += t.importance
  }
  return total > 0 ? have / total : null
}

// Abilities are aptitudes, not something a gap list can tell a person to go and build.
export type GapKind = 'SKILL' | 'KNOWLEDGE' | 'ACTIVITY'
const GAP_KINDS: ElementKind[] = ['SKILL', 'KNOWLEDGE', 'ACTIVITY']

export interface RatedGap {
  skillId: string
  name: string
  kind: GapKind
  sourceLevel: number
  targetLevel: number
}

const MIN_LEVEL_GAP = 10

/** Skills and knowledge the target needs at a clearly higher level than the source, biggest first. */
export function ratedGaps(source: OccupationProfile, target: OccupationProfile, limit = 6): RatedGap[] {
  const gaps: (RatedGap & { weight: number })[] = []
  for (const [id, t] of target.elements) {
    if (!RATED(t) || t.importance < REQUIRED_IMPORTANCE || !GAP_KINDS.includes(t.kind)) continue
    const s = source.elements.get(id)
    const sourceLevel = s && RATED(s) ? s.level ?? 0 : 0
    const targetLevel = t.level ?? 0
    const delta = targetLevel - sourceLevel
    if (delta < MIN_LEVEL_GAP) continue
    gaps.push({
      skillId: id,
      name: t.name,
      kind: t.kind as GapKind,
      sourceLevel,
      targetLevel,
      weight: delta * t.importance,
    })
  }
  return gaps
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map(({ weight: _weight, ...gap }) => gap)
}

export interface ToolGap {
  skillId: string
  name: string
  hotTech: boolean
}

export function normalizeSkillText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Tools and technologies the target role uses that the source role doesn't
 * and the person's own resume doesn't mention. These are concrete and
 * checkable ("Salesforce", "SAP"), unlike O*NET's generic skill names, which
 * is why they feed the skill-gap suggestions. In-demand ("hot") ones first.
 */
export function toolGaps(
  source: OccupationProfile | null,
  target: OccupationProfile,
  resumeKeywords: string[],
  limit = 6,
  /** Tools the resume already evidences, found through the alias layer ("SFDC" means Salesforce). */
  haveSkillIds: ReadonlySet<string> = new Set()
): ToolGap[] {
  const have = new Set(resumeKeywords.map(normalizeSkillText).filter(Boolean))
  const haveText = [...have].join(' | ')
  const out: (ToolGap & { importance: number })[] = []
  for (const [id, t] of target.elements) {
    if (t.kind !== 'TECHNOLOGY') continue
    if (source?.elements.has(id) || haveSkillIds.has(id)) continue
    const name = normalizeSkillText(t.name)
    if (!name || have.has(name) || haveText.includes(name)) continue
    out.push({ skillId: id, name: t.name, hotTech: t.hotTech, importance: t.importance })
  }
  return out
    .sort((a, b) => Number(b.hotTech) - Number(a.hotTech) || b.importance - a.importance || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ importance: _importance, ...gap }) => gap)
}
