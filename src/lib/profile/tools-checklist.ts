import 'server-only'
import { prisma } from '@/lib/prisma'
import { getTaxonomy } from '@/lib/careers/taxonomy'
import { loadJobSocs } from '@/lib/jobs/search-breadth-server'
import { resolveCandidateOccupation } from '@/lib/careers/candidate-occupation'
import { textSkillIds } from '@/lib/careers/text-skill-ids'
import { onetSocForRole } from '@/lib/pivots/onet-soc'
import { detectSourceRole } from '@/lib/pivots/pivot-map'
import { skillTerms, type SkillMatrixInput } from '@/lib/profile/skill-matrix'

// "Tools you use": a short checklist on the skills page so the board's skills criterion
// (src/lib/jobs/relevance.ts) has the member's tools to compare with the tools postings name.
// Suggestions are the tools that live postings in their occupation name most often (the
// board's skillIds), topped up with O*NET's in-demand tools for it; the ones their résumé,
// LinkedIn or confirmed skills already name come pre-checked, so they only confirm.

export const TOOLS_TO_SUGGEST = 20
const BASIC = /^(microsoft (word|outlook|powerpoint|teams|office|windows|edge|365)|google (docs|sheets|drive|meet|workspace|chrome)|adobe acrobat|zoom|slack|email|electronic mail|web browser|internet browser|word processing|spreadsheet|presentation)\b/i

export interface ToolOption {
  id: string
  name: string
  checked: boolean
}

export type ToolsMember = SkillMatrixInput & { id: string; primaryFunction?: string | null; resumeLatestJobTitle?: string | null }

const plain = (name: string) => name.replace(/\s+software$/i, '').trim()
// O*NET's category entries ("Database software", "Workflow software") name a kind of tool, not one to tick.
const CATEGORY = /^(database|mapping|workflow|financial planning|workforce management|reporting|scheduling|project planning|project management|accounting|budgeting|word processing|presentation|spreadsheet|data base user interface and query|application management|data analysis|software development tools|enterprise resource planning erp|customer relationship management crm|human resources|time accounting|inventory management|document management|web page creation and editing|graphics or photo imaging|electronic mail|office suite|analytical or scientific|business intelligence and data analysis|development environment|operating system|object or component oriented development|internet browser|video conferencing|instant messaging)( software)?$/i

export async function suggestTools(m: ToolsMember): Promise<ToolOption[]> {
  const taxonomy = await getTaxonomy().catch(() => null)
  if (!taxonomy) return []
  const resolved = await resolveCandidateOccupation(m.id).catch(() => null)
  const stand = onetSocForRole(detectSourceRole({ title: m.resumeLatestJobTitle, primaryFunction: m.primaryFunction }) ?? '')
  const soc = resolved?.status === 'resolved' ? resolved.socCode : stand
  const occ = soc ? taxonomy.profiles.get(soc) : undefined
  const keywords = skillTerms(m)
  // Through the text-safe aliases only: a bare "CRM" on a résumé is not Sugar CRM.
  const have = textSkillIds(...keywords)
  const out: ToolOption[] = []
  // What live postings in their occupation actually ask for, most often first.
  if (soc) {
    const occupations = await loadJobSocs()
    const counts = new Map<string, number>()
    for (const [jobId, jobSoc] of occupations.socs) {
      if (jobSoc !== soc) continue
      for (const id of occupations.skillIds.get(jobId) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    const top = [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, TOOLS_TO_SUGGEST * 2)
    const names = new Map((await prisma.skill.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, name: true } })).map((r) => [r.id, r.name]))
    for (const [id] of top) {
      const name = names.get(id)
      if (!name || BASIC.test(name) || CATEGORY.test(name) || out.length >= TOOLS_TO_SUGGEST) continue
      out.push({ id, name: plain(name), checked: have.has(id) })
    }
  }
  // Topped up with O*NET's in-demand tools for the occupation.
  if (occ && out.length < TOOLS_TO_SUGGEST) {
    const tech = [...occ.elements.entries()]
      .filter(([id, e]) => e.kind === 'TECHNOLOGY' && e.hotTech && !BASIC.test(e.name) && !CATEGORY.test(e.name) && !out.some((o) => o.id === id))
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    for (const [id, e] of tech.slice(0, TOOLS_TO_SUGGEST - out.length)) out.push({ id, name: plain(e.name), checked: have.has(id) })
  }
  // Tools they already name that the occupation list doesn't: pre-checked, so they confirm them too.
  const names = new Map<string, string>()
  for (const p of taxonomy.profiles.values()) for (const [id, e] of p.elements) if (e.kind === 'TECHNOLOGY') names.set(id, e.name)
  for (const id of have) {
    if (out.length >= TOOLS_TO_SUGGEST + 5) break
    const name = names.get(id)
    if (name && !BASIC.test(name) && !CATEGORY.test(name) && !out.some((o) => o.id === id)) out.push({ id, name: plain(name), checked: true })
  }
  // The ones they already name first: mostly a confirmation.
  return [...out.filter((o) => o.checked), ...out.filter((o) => !o.checked)]
}
