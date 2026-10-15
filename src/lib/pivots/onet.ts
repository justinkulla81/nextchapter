// O*NET on pivot paths: the skills and tools a target occupation leans on more
// than the member's own, and extra pivot edges taken from O*NET's related-
// occupation lists. Data: onet-occupations.json, built by scripts/pivots/import-onet.ts
// from the O*NET Web Services import (USDOL/ETA) — no API call at request time.
//
// Hand-written edges (pivot-map.ts) keep their own "why it works". A data-driven
// edge is added only when O*NET lists the target among the source occupation's
// related occupations AND the two share most of their skill profile (transferable-
// skills rule below) AND the preparation level is comparable; rankPivots then drops
// it when the board has too few open roles for it (market-demand rule). Its reason
// is a plain templated sentence, never generated text.

import data from './onet-occupations.json'
import { techTermEntry } from '@/lib/onet/tech-term-rules'
import { onetSocForRole } from './onet-soc'
import { ROLES, SOURCES, type PivotEdge } from './pivot-map'

interface Rated {
  name: string
  importance: number
}
export interface OnetPivotOccupation {
  title: string
  jobZone: number | null
  skills: Rated[]
  knowledge: Rated[]
  tech: string[]
  related: { code: string; tier: string; index: number }[]
  skillVector: Record<string, number>
}

const OCC = (data as unknown as { occupations: Record<string, OnetPivotOccupation> }).occupations

export const ONET_SOURCE_LABEL = 'O*NET'

export function onetOccupation(soc: string | null | undefined): OnetPivotOccupation | null {
  return (soc && OCC[soc]) || null
}

// ── Skills to add ───────────────────────────────────────────────────────────

/** Importance (1-5) a skill must have in the target to be worth naming. */
const SKILL_FLOOR = 3.5
/** How much more the target leans on it than the source does. */
const SKILL_GAP = 0.4
const MAX_SKILLS = 3
const MAX_TOOLS = 4
/** Office basics every senior candidate has; never listed as a tool to add. */
const BASIC_TOOLS = /^(microsoft (word|outlook|excel|powerpoint|teams|office|windows|edge)|google (docs|sheets|meet|drive)|adobe acrobat|apple macos|zoom|slack)\b/i

/** Too universal to say anything about a move. */
const UNINFORMATIVE = new Set(['English Language'])
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
const plainTool = (name: string) => name.replace(/\s+software$/i, '').trim()

export interface OnetGaps {
  /** O*NET skills and knowledge the target leans on clearly more, sentence case. */
  skills: string[]
  /** O*NET Hot Technology / In Demand tools the target uses and the source occupation does not. */
  tools: string[]
  /** The two occupations compared, for the credit line. */
  targetOccupation: string
  sourceOccupation: string | null
}

/**
 * What O*NET says the target asks for beyond the member's starting point. Skills
 * need a source occupation to compare against; tools only need the target. Anything
 * the member's own skills already show (whole word) is left out. Null when there is
 * nothing to add or the target has no O*NET occupation.
 */
export function onetGaps(sourceKey: string | null, targetKey: string, hasSkill: (aliases: string[]) => boolean): OnetGaps | null {
  const t = onetOccupation(onetSocForRole(targetKey))
  if (!t) return null
  const sourceSoc = sourceKey ? onetSocForRole(sourceKey) : null
  const s = onetOccupation(sourceSoc)
  if (s && sourceSoc === onetSocForRole(targetKey)) return null

  const skills: string[] = []
  if (s) {
    const sourceImp = new Map([...s.skills, ...s.knowledge].map((r) => [r.name, r.importance]))
    for (const [name, v] of Object.entries(s.skillVector)) if (!sourceImp.has(name)) sourceImp.set(name, v)
    const diffs = [...t.skills, ...t.knowledge]
      .filter((r) => r.importance >= SKILL_FLOOR && !UNINFORMATIVE.has(r.name))
      .map((r) => ({ name: r.name, gap: r.importance - (sourceImp.get(r.name) ?? 1) }))
      .filter((d) => d.gap >= SKILL_GAP)
      .sort((a, b) => b.gap - a.gap)
    for (const d of diffs) {
      if (skills.length >= MAX_SKILLS) break
      if (!hasSkill([d.name.toLowerCase()])) skills.push(sentence(d.name))
    }
  }

  const sourceTools = new Set(s?.tech ?? [])
  const tools: string[] = []
  for (const name of t.tech) {
    if (tools.length >= MAX_TOOLS) break
    if (sourceTools.has(name) || BASIC_TOOLS.test(name)) continue
    const entry = techTermEntry(name)
    if (!entry || hasSkill(entry.aliases)) continue
    tools.push(plainTool(name))
  }
  if (skills.length === 0 && tools.length === 0) return null
  return { skills, tools, targetOccupation: t.title, sourceOccupation: s?.title ?? null }
}

// ── Data-driven edges ───────────────────────────────────────────────────────

/** Pearson correlation of two occupations' skill-importance profiles (35 O*NET skills). */
export function skillProfileSimilarity(a: OnetPivotOccupation, b: OnetPivotOccupation): number {
  const keys = Object.keys(a.skillVector).filter((k) => k in b.skillVector)
  if (keys.length < 10) return 0
  const xs = keys.map((k) => a.skillVector[k])
  const ys = keys.map((k) => b.skillVector[k])
  const mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < keys.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0
}

/** Transferable-skills rule: the two skill profiles must move together this strongly. */
export const MIN_SKILL_SIMILARITY = 0.75
export const MAX_ONET_EDGES = 3
/** Market-demand rule (applied in rankPivots): fewer open roles nationally than this and the edge is not shown. */
export const ONET_EDGE_MIN_OPEN = 25

/**
 * The pivot role an O*NET occupation stands for when it is the TARGET of a
 * data-driven edge. An allowlist: only occupations that honestly are that role
 * (Computer Systems Analysts is not "HRIS", Sales Managers is not "customer
 * success"), so a related occupation never lands on a near-miss role.
 */
export const DATA_EDGE_TARGET: Record<string, string> = {
  '41-3091.00': 'account_executive',
  '13-1071.00': 'talent_acquisition',
  '13-1131.00': 'fundraising',
  '41-9031.00': 'solutions_consulting',
  '41-4011.00': 'healthcare_sales',
  '11-3121.00': 'people_operations',
  '13-1151.00': 'learning_development',
  '25-9031.00': 'instructional_design',
  '13-1141.00': 'compensation',
  '13-1082.00': 'project_management',
  '11-1021.00': 'operations_management',
  '13-1023.00': 'procurement',
  '13-1081.00': 'logistics_supply_chain',
  '13-2051.00': 'fpa',
  '15-2051.00': 'data_scientist',
  '11-3021.00': 'engineering_manager',
  '27-3031.00': 'communications',
  '11-9033.00': 'education_admin',
  '11-9151.00': 'nonprofit_programs',
  '13-1111.00': 'management_consulting',
  '15-2051.01': 'data_analyst',
  '13-1041.00': 'compliance',
  '11-9111.00': 'clinical_operations',
  '13-1121.00': 'event_management',
  '15-1212.00': 'security_risk',
}

/** Roles that work as pivot targets (a hand-written edge already points at them, so their needs are written). */
const TARGET_ROLES = new Set([...SOURCES.values()].flatMap((s) => s.edges.map((e) => e.to)))

function targetRoleForSoc(soc: string, exclude: string): string | null {
  const role = DATA_EDGE_TARGET[soc]
  return role && role !== exclude && TARGET_ROLES.has(role) ? role : null
}

/** Average importance of each skill across the pivot occupations, so "shared" means shared and distinctive. */
const SKILL_MEAN: Record<string, number> = (() => {
  const sum: Record<string, [number, number]> = {}
  for (const o of Object.values(OCC)) for (const [k, v] of Object.entries(o.skillVector)) sum[k] = [(sum[k]?.[0] ?? 0) + v, (sum[k]?.[1] ?? 0) + 1]
  return Object.fromEntries(Object.entries(sum).map(([k, [s, n]]) => [k, s / n]))
})()

/** Knowledge areas both occupations rank highly, then skills both use well above the usual level. */
function sharedSkills(a: OnetPivotOccupation, b: OnetPivotOccupation, n: number): string[] {
  const bKnow = new Map(b.knowledge.map((k) => [k.name, k.importance]))
  const knowledge = a.knowledge
    .filter((k) => !UNINFORMATIVE.has(k.name) && k.importance >= 3.5 && (bKnow.get(k.name) ?? 0) >= 3.5)
    .sort((x, y) => Math.min(y.importance, bKnow.get(y.name)!) - Math.min(x.importance, bKnow.get(x.name)!))
    .map((k) => k.name)
  const skills = Object.keys(a.skillVector)
    .filter((k) => k in b.skillVector)
    .map((k) => ({ k, lift: Math.min(a.skillVector[k], b.skillVector[k]) - (SKILL_MEAN[k] ?? 0) }))
    .filter((x) => x.lift >= 0.25)
    .sort((x, y) => y.lift - x.lift || x.k.localeCompare(y.k))
    .map((x) => x.k)
  return [...new Set([...knowledge, ...skills])].slice(0, n).map(sentence)
}

const edgeCache = new Map<string, PivotEdge[]>()

/**
 * Extra edges for a source role from O*NET's related occupations (Primary tiers
 * only), skipping any target the hand-written map already reaches directly or
 * through an occupation it already covers.
 */
export function onetEdges(sourceKey: string): PivotEdge[] {
  const cached = edgeCache.get(sourceKey)
  if (cached) return cached
  const out: PivotEdge[] = []
  const sourceSoc = onetSocForRole(sourceKey)
  const s = onetOccupation(sourceSoc)
  const curated = SOURCES.get(sourceKey)?.edges ?? []
  const source = ROLES.get(sourceKey)
  if (s && source) {
    const curatedTargets = new Set(curated.map((e) => e.to))
    const curatedSocs = new Set(curated.map((e) => onetSocForRole(e.to)).filter(Boolean))
    for (const rel of s.related) {
      if (out.length >= MAX_ONET_EDGES) break
      if (!rel.tier.startsWith('Primary') || rel.code === sourceSoc || curatedSocs.has(rel.code)) continue
      const role = targetRoleForSoc(rel.code, sourceKey)
      const t = onetOccupation(rel.code)
      if (!role || !t || curatedTargets.has(role) || out.some((e) => e.to === role)) continue
      if (skillProfileSimilarity(s, t) < MIN_SKILL_SIMILARITY) continue
      if (s.jobZone !== null && t.jobZone !== null && t.jobZone > s.jobZone + 1) continue
      const shared = sharedSkills(s, t, 3)
      if (shared.length < 2) continue
      out.push({
        to: role,
        brings: shared,
        time: 'months',
        path: s.jobZone !== null && t.jobZone !== null && t.jobZone > s.jobZone ? 'RESET' : 'KEEP_SENIORITY',
        fit: rel.tier === 'Primary-Short' ? 'adjacent' : 'stretch',
        why: `O*NET lists this among the occupations most related to ${source.label.toLowerCase()} work. Both draw on the same core areas: ${shared.map((x) => x.toLowerCase()).join('; ')}.`,
        origin: 'onet',
      })
    }
  }
  edgeCache.set(sourceKey, out)
  return out
}

/** Every edge from a source: the hand-written ones first, then O*NET's. */
export function edgesFor(sourceKey: string | null): PivotEdge[] {
  if (!sourceKey) return []
  return [...(SOURCES.get(sourceKey)?.edges ?? []), ...onetEdges(sourceKey)]
}
