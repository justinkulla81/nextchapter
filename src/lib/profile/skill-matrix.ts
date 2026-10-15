// The skills matrix: one list of a person's skills, each with where it came
// from (resume, their own confirmation, a certification), a level and the
// evidence behind it. Every feature that matches skills (job fit, pivots,
// skill gaps, learning, college programs) reads skillTerms() so they all see
// the same skills.
//
// Derived on read from resumeKeywords, confirmedSkillsHave and
// certifications; the only stored part is what the person set themselves
// (CandidateProfile.skillLevels: a level, or "removed"). Pure and client-safe.

export type SkillLevel = 'used' | 'strong' | 'expert'
export type SkillSource = 'resume' | 'self' | 'certification'

export const SKILL_LEVELS: { key: SkillLevel; label: string; help: string }[] = [
  { key: 'used', label: 'Used it', help: 'You’ve done it in a job, with help or now and then.' },
  { key: 'strong', label: 'Strong', help: 'You do it well on your own, regularly.' },
  { key: 'expert', label: 'Expert', help: 'Others come to you for it; you could teach it.' },
]
export const SOURCE_LABEL: Record<SkillSource, string> = { resume: 'Resume', self: 'You added', certification: 'Certification' }

export type SkillRow = {
  key: string
  label: string
  sources: SkillSource[]
  level: SkillLevel
  // Whether the level is the person's own or our inference from the sources.
  levelSetBy: 'person' | 'inferred'
  evidence: string | null
}

type StoredLevel = { level?: SkillLevel; removed?: boolean }
export type SkillMatrixInput = {
  resumeKeywords?: string[] | null
  confirmedSkillsHave?: string[] | null
  certifications?: string[] | null
  skillLevels?: unknown
}

export const skillKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export function readSkillLevels(json: unknown): Record<string, StoredLevel> {
  if (!json || typeof json !== 'object') return {}
  const out: Record<string, StoredLevel> = {}
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const o = v as StoredLevel
    out[skillKey(k)] = { ...(o.level && SKILL_LEVELS.some((l) => l.key === o.level) ? { level: o.level } : {}), ...(o.removed ? { removed: true } : {}) }
  }
  return out
}

const RANK: Record<SkillLevel, number> = { used: 1, strong: 2, expert: 3 }

export function buildSkillMatrix(input: SkillMatrixInput): SkillRow[] {
  const stored = readSkillLevels(input.skillLevels)
  const rows = new Map<string, { label: string; sources: Set<SkillSource> }>()
  const add = (raw: string, source: SkillSource) => {
    const label = raw.trim()
    if (!label) return
    const k = skillKey(label)
    const r = rows.get(k) ?? { label, sources: new Set<SkillSource>() }
    r.sources.add(source)
    rows.set(k, r)
  }
  for (const s of input.certifications ?? []) add(s, 'certification')
  for (const s of input.confirmedSkillsHave ?? []) add(s, 'self')
  for (const s of input.resumeKeywords ?? []) add(s, 'resume')
  return [...rows.entries()]
    .filter(([k]) => !stored[k]?.removed)
    .map(([key, r]) => {
      const sources = [...r.sources]
      // A certification or two independent sources = strong; one = used.
      const inferred: SkillLevel = sources.includes('certification') || sources.length >= 2 ? 'strong' : 'used'
      const own = stored[key]?.level
      return {
        key,
        label: r.label,
        sources,
        level: own ?? inferred,
        levelSetBy: own ? ('person' as const) : ('inferred' as const),
        evidence: sources.includes('certification') ? `Certification: ${r.label}` : sources.includes('resume') ? 'On your resume' : null,
      }
    })
    .sort((a, b) => RANK[b.level] - RANK[a.level] || b.sources.length - a.sources.length || a.label.localeCompare(b.label))
}

// Lowercase skill terms for matching, strongest first. The one list every
// matcher reads (replaces each feature's own mix of the three fields).
export function skillTerms(input: SkillMatrixInput): string[] {
  return buildSkillMatrix(input).map((r) => r.key)
}

// The person's strongest skills, for places that can only use a few.
export function topSkills(input: SkillMatrixInput, n: number): string[] {
  return buildSkillMatrix(input).slice(0, n).map((r) => r.label)
}

export function skillDepth(input: SkillMatrixInput): { total: number; strong: number; expert: number } {
  const rows = buildSkillMatrix(input)
  return { total: rows.length, strong: rows.filter((r) => r.level === 'strong').length, expert: rows.filter((r) => r.level === 'expert').length }
}
