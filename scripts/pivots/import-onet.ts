// Builds the O*NET data the pivot paths and posting skill scan read at runtime,
// from the O*NET Web Services import the crawler keeps
// (~/nextchapter-jobs/scripts/onet_import.py -> data/onet/*.json). No API calls
// here and none at request time; re-run after each yearly O*NET import.
//
//   node --import tsx scripts/pivots/import-onet.ts [--from ~/nextchapter-jobs/data/onet]
//
// Writes:
//   src/lib/pivots/onet-occupations.json  skills, knowledge, hot technology and related
//                                          occupations for every SOC the pivot map uses
//   src/lib/onet/tech-terms.json           O*NET Hot Technology / In Demand tools, with the
//                                          plain ways postings write them, for the skill scan
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pivotSocCodes } from '../../src/lib/pivots/onet-soc'
import { SKILL_TERMS } from '../../src/lib/companies/skills-extraction'
import { techTermEntry } from '../../src/lib/onet/tech-term-rules'

interface RawOcc {
  code: string
  title: string
  jobZone?: number
  skills: { name: string; importance: number }[]
  knowledge: { name: string; importance: number }[]
  technology: { name: string; category: string; hot: boolean; inDemand: boolean }[]
  related: { code: string; title: string; tier: string; index: number }[]
  skillVector: Record<string, number>
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const from = arg('from') ?? join(homedir(), 'nextchapter-jobs', 'data', 'onet')
const occ = JSON.parse(readFileSync(join(from, 'occupations.json'), 'utf8')) as Record<string, RawOcc>
const meta = JSON.parse(readFileSync(join(from, 'meta.json'), 'utf8')) as { database: string; importedAt: string }

const codes = pivotSocCodes()
const missing = codes.filter((c) => !occ[c])
if (missing.length) throw new Error(`SOC codes not in the O*NET import: ${missing.join(', ')}`)

const round = (n: number) => Math.round(n * 100) / 100
const occupations: Record<string, unknown> = {}
for (const c of codes) {
  const o = occ[c]
  occupations[c] = {
    title: o.title,
    jobZone: o.jobZone ?? null,
    skills: o.skills.map((s) => ({ name: s.name, importance: round(s.importance) })),
    knowledge: o.knowledge.map((s) => ({ name: s.name, importance: round(s.importance) })),
    // Tools employers ask for in this occupation's postings (O*NET "In Demand"), at most 15.
    tech: o.technology.filter((t) => t.inDemand).slice(0, 15).map((t) => t.name),
    related: o.related.map((r) => ({ code: r.code, tier: r.tier, index: r.index })),
    skillVector: Object.fromEntries(Object.entries(o.skillVector).map(([k, v]) => [k, round(v)])),
  }
}
writeFileSync(
  'src/lib/pivots/onet-occupations.json',
  JSON.stringify({ source: 'O*NET Web Services (USDOL/ETA)', database: meta.database, importedAt: meta.importedAt, occupations }, null, 1) + '\n'
)
console.log(`onet-occupations.json: ${codes.length} occupations (${meta.database}).`)

// Tools for the posting skill scan.
const names = new Set<string>()
for (const o of Object.values(occ)) for (const t of o.technology) if (t.hot || t.inDemand) names.add(t.name)
const existing = new Set(SKILL_TERMS.map((t) => t.toLowerCase()))
const byTerm = new Map<string, Set<string>>()
for (const e of [...names].map(techTermEntry)) {
  if (!e || e.aliases.some((a) => existing.has(a))) continue // already in the hand-written list
  byTerm.set(e.term, new Set([...(byTerm.get(e.term) ?? []), ...e.aliases]))
}
const terms = [...byTerm.entries()]
  .map(([term, aliases]) => ({ term, aliases: [...aliases].sort((a, b) => b.length - a.length) }))
  .sort((a, b) => a.term.localeCompare(b.term))
mkdirSync('src/lib/onet', { recursive: true })
writeFileSync('src/lib/onet/tech-terms.json', JSON.stringify({ source: 'O*NET Web Services (USDOL/ETA)', database: meta.database, terms }, null, 1) + '\n')
console.log(`tech-terms.json: ${terms.length} tools from ${names.size} O*NET Hot Technology / In Demand names.`)
