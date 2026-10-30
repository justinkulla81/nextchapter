/**
 * Career services, alumni, advancement and executive-education leaders at graduate and professional schools
 * (~/nc-hunter-results/2026-10-30-highered/grad-*.json, read from each school's own staff pages).
 * Each person is tagged with the higher-ed contact type for their function, and the school kind in brackets after the title.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/gradschool-import.ts [--apply]
 */
import { readFileSync, existsSync } from 'node:fs'
import type { CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

const DIR = `${process.env.HOME}/nc-hunter-results/2026-10-30-highered`
const apply = process.argv.includes('--apply')
const ROLE: Record<string, CrmPersonRole> = { career: 'HIGHER_ED_CAREER', alumni: 'ALUMNI_OFFICE', advancement: 'HIGHER_ED_DEVELOPMENT', execed: 'HIGHER_ED_EXEC_ED' }
const LEADER = /director|dean|chief|vice president|\bvp\b|head of|president|chancellor/i
const JUNIOR = /coordinator|specialist|assistant (director|dean)(?!.*dean)|advisor|adviser|analyst|manager(?!.*director)|intern\b|administrative/i

async function main() {
  const rows: any[] = [
    ...(existsSync(`${DIR}/grad-business.json`) ? JSON.parse(readFileSync(`${DIR}/grad-business.json`, 'utf8')).map((r: any) => ({ ...r, kind: 'business' })) : []),
    ...(existsSync(`${DIR}/grad-law-other.json`) ? JSON.parse(readFileSync(`${DIR}/grad-law-other.json`, 'utf8')) : []),
  ]
  const t: Record<string, number> = { kept: 0, dropped: 0, added: 0, matched: 0, review: 0, removed: 0, withEmail: 0 }
  const seen = new Set<string>()
  for (const r of rows) {
    const role = ROLE[r.function]; const key = `${r.name}|${r.school}`.toLowerCase()
    if (!role || !r.name || r.name.trim().split(/\s+/).length < 2 || !r.title || !r.source_url || !LEADER.test(r.title) || JUNIOR.test(r.title) || seen.has(key)) { t.dropped++; continue }
    seen.add(key); t.kept++
    let email = (r.email || '').trim().toLowerCase()
    if (email && r.domain && !email.endsWith(r.domain.split('.').slice(-2).join('.'))) email = ''
    if (email) t.withEmail++
    if (!apply) continue
    const org = await ensureOrg({ name: r.school, type: 'UNIVERSITY' as never, website: r.domain ? `https://${r.domain}` : undefined })
    const roles: CrmPersonRole[] = [role]
    const res = await addContactToCrm({
      fullName: r.name, title: `${r.title} [${r.kind} school, ${r.function}]`, email: email || null, orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
      note: `${r.title} at ${r.school}${r.university && r.university !== r.school ? ` (${r.university})` : ''}, a ${r.kind} school. Graduate-school ${r.function} lead: laid-off alumni reach out to these offices. ${r.evidence_note ?? ''} Source: ${r.source_url}. Found by web research 2026-10-30.`,
    })
    if (res.outcome === 'removed') t.removed++; else t[res.outcome]++
  }
  console.log(t); await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
