import { lookupSocCode } from '@/lib/market/soc-codes'
import { buildCorpusMeans, type Vector } from './similarity'
import { pivotPaths, type PivotPath } from './pivot-paths'
import { toSocCode } from './target-occupations'
import { buildTitleIndex, titleToOccupation, type TitleIndex } from './title-to-soc'
import type { ElementKind, OccupationOutlook, OccupationPay, OccupationProfile } from './types'

// The in-scope occupations assembled for scoring, and the step from a member's profile
// to their pivot paths. Pure over plain rows (the database read is load-corpus.ts), so
// it is tested without a database (src/test/occupations-corpus.test.ts).

export interface OccupationRows {
  occupations: {
    onetSocCode: string
    socCode: string
    title: string
    jobZone: number | null
    isTarget: boolean
    elements: { kind: string; elementId: string; elementName: string; importance: number; level: number }[]
    techSkills: { example: string; commodity: string | null; hotTechnology: boolean }[]
  }[]
  altTitles: { onetSocCode: string; title: string }[]
  wages: { socCode: string; year: number; wageMedian: number | null; topCoded: boolean }[]
  projections: { socCode: string; changePct: number | null; annualOpenings: number | null }[]
  related: { onetSocCode: string; relatedOnetSocCode: string }[]
}

export interface OccupationCorpus {
  profiles: OccupationProfile[]
  byOnetSoc: Map<string, OccupationProfile>
  titleIndex: TitleIndex
  means: Vector
  pay: Map<string, OccupationPay>
  outlook: Map<string, OccupationOutlook>
  related: Map<string, Set<string>>
}

const ELEMENT_KINDS = new Set<string>(['SKILL', 'KNOWLEDGE', 'ABILITY', 'ACTIVITY'])

export function buildCorpus(rows: OccupationRows): OccupationCorpus {
  const profiles: OccupationProfile[] = rows.occupations
    .filter((o) => o.isTarget)
    .map((o) => ({
      onetSocCode: o.onetSocCode,
      socCode: o.socCode,
      title: o.title,
      jobZone: o.jobZone,
      isTarget: true,
      elements: o.elements
        .filter((e) => ELEMENT_KINDS.has(e.kind))
        .map((e) => ({ kind: e.kind as ElementKind, elementId: e.elementId, name: e.elementName, importance: e.importance, level: e.level })),
      techSkills: o.techSkills,
    }))
  const byOnetSoc = new Map(profiles.map((p) => [p.onetSocCode, p]))

  // The latest year of national pay for each SOC code.
  const latest = new Map<string, OccupationRows['wages'][number]>()
  for (const w of rows.wages) {
    const prev = latest.get(w.socCode)
    if (!prev || w.year > prev.year) latest.set(w.socCode, w)
  }
  const pay = new Map([...latest].map(([soc, w]) => [soc, { socCode: soc, medianWage: w.wageMedian, topCoded: w.topCoded }]))
  const outlook = new Map(rows.projections.map((p) => [p.socCode, { socCode: p.socCode, changePct: p.changePct, annualOpenings: p.annualOpenings }]))

  const related = new Map<string, Set<string>>()
  for (const r of rows.related) {
    const set = related.get(r.onetSocCode) ?? new Set<string>()
    set.add(r.relatedOnetSocCode)
    related.set(r.onetSocCode, set)
  }

  return {
    profiles,
    byOnetSoc,
    titleIndex: buildTitleIndex(profiles, rows.altTitles.filter((a) => byOnetSoc.has(a.onetSocCode))),
    means: buildCorpusMeans(profiles),
    pay,
    outlook,
    related,
  }
}

export interface MemberForPivot {
  resumeLatestJobTitle: string | null
  primaryFunction: string | null
  /** The function the member is considering moving into. */
  targetFunction: string | null
  /** resumeKeywords plus confirmedSkillsHave. */
  keywords: string[]
}

export type CurrentBasis = 'title' | 'function'

/** Everything the card shows for one path, as plain serialisable values. */
export interface PivotPathView {
  socCode: string
  title: string
  score: number
  transferability: number | null
  toolsHave: string[]
  toolsMissing: string[]
  skillGaps: string[]
  medianWage: number | null
  /** The median is only a floor ("$239,200 or more"). */
  medianIsFloor: boolean
  payChangePct: number | null
  growthPct: number | null
  annualOpenings: number | null
  onetRelated: boolean
}

export type MemberPivotResult =
  | {
      status: 'ok'
      current: { title: string; socCode: string; basis: CurrentBasis }
      /** The role the member said they are considering, when it differs from where they are. */
      considering: PivotPathView | null
      paths: PivotPathView[]
    }
  | { status: 'unmapped' }
  | { status: 'unavailable' }

export function toPathView(p: PivotPath): PivotPathView {
  return {
    socCode: p.target.socCode,
    title: p.target.title,
    score: p.fit.score ?? 0,
    transferability: p.fit.transferability,
    toolsHave: p.fit.tools.have,
    toolsMissing: p.fit.tools.missing,
    skillGaps: p.fit.gaps.map((g) => g.name),
    medianWage: p.targetPay?.medianWage ?? null,
    medianIsFloor: p.targetPay?.topCoded ?? false,
    payChangePct: p.pay?.changePct ?? null,
    growthPct: p.outlook?.changePct ?? null,
    annualOpenings: p.outlook?.annualOpenings ?? null,
    onetRelated: p.onetRelated,
  }
}

/** The corpus occupation a function name stands for, through the curated function-to-SOC map. */
function occupationForFunction(fn: string | null, corpus: OccupationCorpus): OccupationProfile | null {
  const soc = toSocCode(lookupSocCode(fn)?.code ?? '')
  if (!soc) return null
  const matches = corpus.profiles.filter((p) => p.socCode === soc)
  return matches.find((p) => p.onetSocCode.endsWith('.00')) ?? matches[0] ?? null
}

export function resolveMemberPivot(corpus: OccupationCorpus, member: MemberForPivot): MemberPivotResult {
  if (corpus.profiles.length === 0) return { status: 'unavailable' }

  let current: OccupationProfile | null = null
  let basis: CurrentBasis = 'title'
  const mapped = member.resumeLatestJobTitle ? titleToOccupation(member.resumeLatestJobTitle, corpus.titleIndex) : null
  if (mapped) current = corpus.byOnetSoc.get(mapped.onetSocCode) ?? null
  if (!current) {
    current = occupationForFunction(member.primaryFunction, corpus)
    basis = 'function'
  }
  if (!current) return { status: 'unmapped' }

  const common = { current, memberKeywords: member.keywords, means: corpus.means, pay: corpus.pay, outlook: corpus.outlook, relatedOnetSocCodes: corpus.related.get(current.onetSocCode) }
  const considered = occupationForFunction(member.targetFunction, corpus)
  const considering =
    considered && considered.socCode !== current.socCode
      ? pivotPaths({ ...common, candidates: [considered], minScore: 0, limit: 1 })[0] ?? null
      : null

  const paths = pivotPaths({ ...common, candidates: corpus.profiles })
    .filter((p) => p.target.socCode !== considering?.target.socCode)
    .map(toPathView)

  return {
    status: 'ok',
    current: { title: current.title, socCode: current.socCode, basis },
    considering: considering ? toPathView(considering) : null,
    paths,
  }
}
