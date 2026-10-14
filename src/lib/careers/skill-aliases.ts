import { normalizeSkillText } from '@/lib/careers/vectors'

/**
 * Alias layer: the many ways people write a tool or skill, mapped to the O*NET skill they mean
 * ("SFDC" and "Salesforce CRM" both mean Salesforce). Built offline once (see
 * scripts/careers/build-skill-aliases.ts) and stored; at runtime it is only a lookup, so matching a
 * resume to O*NET costs nothing per page view.
 *
 * Pure: no database, so the rules can be tested.
 */
export interface AliasRow {
  alias: string
  skillId: string
  source: 'BUILTIN' | 'NAME' | 'LLM' | 'ADMIN'
}

/** Words that add nothing when matching a tool name ("Salesforce software" is just Salesforce). */
const FILLER = new Set(['software', 'suite', 'platform', 'system', 'systems', 'application', 'applications', 'tool', 'tools', 'program', 'programs', 'app'])
/** Vendor prefixes people drop in conversation ("Excel" for "Microsoft Excel"). */
const VENDOR_PREFIXES = ['microsoft', 'oracle', 'adobe', 'google', 'amazon', 'ibm', 'sap']

/**
 * Names a tool can go by, from its own O*NET name: itself, without filler words, and without a
 * leading vendor name. "Microsoft Excel" gives "microsoft excel" and "excel"; "Salesforce software"
 * gives "salesforce software" and "salesforce". Variants shorter than 3 characters are dropped
 * because "r" or "c" would match half the internet.
 */
export function nameVariants(toolName: string): string[] {
  const full = normalizeSkillText(toolName)
  if (!full) return []
  const words = full.split(' ')
  const noFiller = words.filter((w) => !FILLER.has(w))
  const variants = new Set<string>([full, noFiller.join(' ')])
  if (noFiller.length > 1 && VENDOR_PREFIXES.includes(noFiller[0])) variants.add(noFiller.slice(1).join(' '))
  return [...variants].filter((v) => v.length >= 3)
}

/**
 * Hand-written aliases for terms the name rule cannot get: abbreviations and shorthand. The value
 * is the tool's common name, found among O*NET's technology skills by the build script; if O*NET
 * does not have a tool by that name the alias is simply not stored.
 */
export const BUILTIN_ALIASES: Record<string, string> = {
  sfdc: 'salesforce',
  'salesforce crm': 'salesforce',
  ms: 'microsoft',
  'ms excel': 'microsoft excel',
  'ms word': 'microsoft word',
  'ms powerpoint': 'microsoft powerpoint',
  powerpoint: 'microsoft powerpoint',
  'ms project': 'microsoft project',
  'ms office': 'microsoft office',
  gsuite: 'google workspace',
  'g suite': 'google workspace',
  js: 'javascript',
  ts: 'typescript',
  'node js': 'node.js',
  nodejs: 'node.js',
  reactjs: 'react',
  'react js': 'react',
  postgres: 'postgresql',
  'power bi': 'microsoft power bi',
  powerbi: 'microsoft power bi',
  gcp: 'google cloud platform',
  aws: 'amazon web services',
  's3': 'amazon web services',
  k8s: 'kubernetes',
  'ci cd': 'jenkins',
  qb: 'quickbooks',
  'quick books': 'quickbooks',
  netsuite: 'oracle netsuite',
  hyperion: 'oracle hyperion',
  'google analytics': 'google analytics',
  ga4: 'google analytics',
  hubspot: 'hubspot',
  jira: 'atlassian jira',
  tableau: 'tableau',
  looker: 'looker',
  'adobe creative suite': 'adobe photoshop',
  photoshop: 'adobe photoshop',
  illustrator: 'adobe illustrator',
  'sap erp': 'sap',
  workday: 'workday',
  'applicant tracking system': 'applicant tracking',
}

export interface AliasIndex {
  /** normalized alias -> skill ids it can mean */
  byAlias: Map<string, Set<string>>
  /** aliases ordered longest first, for whole-phrase search inside longer keywords */
  longestFirst: string[]
}

export function buildAliasIndex(rows: { alias: string; skillId: string }[]): AliasIndex {
  const byAlias = new Map<string, Set<string>>()
  for (const r of rows) {
    const a = normalizeSkillText(r.alias)
    // One-letter aliases (the R language) are allowed, but only ever match a keyword exactly.
    if (a.length < 1) continue
    byAlias.set(a, (byAlias.get(a) ?? new Set()).add(r.skillId))
  }
  return { byAlias, longestFirst: [...byAlias.keys()].sort((a, b) => b.length - a.length) }
}

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `)
}

/**
 * Skill ids a list of resume keywords evidences. A keyword counts if it IS an alias ("sfdc"), or
 * if it contains an alias as a whole phrase ("salesforce crm administration" contains "salesforce").
 * Aliases shorter than 3 characters only count on an exact match, so "r" never matches inside text.
 */
export function resolveSkillIds(keywords: string[], index: AliasIndex): Set<string> {
  const found = new Set<string>()
  for (const raw of keywords) {
    const k = normalizeSkillText(raw)
    if (!k) continue
    const exact = index.byAlias.get(k)
    if (exact) for (const id of exact) found.add(id)
    for (const alias of index.longestFirst) {
      if (alias.length < 3 || alias === k) continue
      if (containsPhrase(k, alias)) for (const id of index.byAlias.get(alias)!) found.add(id)
    }
  }
  return found
}

export interface ToolCandidate {
  id: string
  name: string
}

/**
 * Finds the O*NET tool a name refers to: an exact match on the normalized name or one of its
 * variants first, then the shortest tool whose name contains the term as a whole phrase. Null if
 * none, so an alias is never attached to the wrong tool by guesswork.
 */
export function findToolByName(term: string, tools: ToolCandidate[]): ToolCandidate | null {
  const t = normalizeSkillText(term)
  if (!t) return null
  const exact = tools.find((tool) => nameVariants(tool.name).includes(t))
  if (exact) return exact
  const containing = tools.filter((tool) => containsPhrase(normalizeSkillText(tool.name), t)).sort((a, b) => a.name.length - b.name.length)
  return containing[0] ?? null
}

/** Rows to store: every tool's own name variants, plus built-in aliases that resolve to a real tool. */
export function buildAliasRows(tools: ToolCandidate[], extraTerms: string[] = []): { rows: AliasRow[]; unmapped: string[] } {
  const rows = new Map<string, AliasRow>()
  const put = (alias: string, skillId: string, source: AliasRow['source']) => {
    const a = normalizeSkillText(alias)
    // The first claim on an alias wins, so a name variant never overrides a hand-written alias.
    if (a.length >= 2 && !rows.has(a)) rows.set(a, { alias: a, skillId, source })
  }
  for (const [alias, canonical] of Object.entries(BUILTIN_ALIASES)) {
    const tool = findToolByName(canonical, tools)
    if (tool) put(alias, tool.id, 'BUILTIN')
  }
  for (const tool of tools) for (const v of nameVariants(tool.name)) put(v, tool.id, 'NAME')

  const unmapped: string[] = []
  for (const term of extraTerms) {
    const a = normalizeSkillText(term)
    if (!a || rows.has(a)) continue
    const tool = findToolByName(a, tools)
    if (tool) put(a, tool.id, 'NAME')
    else unmapped.push(term)
  }
  return { rows: [...rows.values()], unmapped }
}
