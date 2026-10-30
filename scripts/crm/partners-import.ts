/**
 * Insurance, brokerage, bank, retirement, benefits-platform and investor partner contacts
 * (~/nc-hunter-results/2026-10-30-partners/partners-*.json, researched from public pages).
 * Each person is tagged with a contact type and the partner kind in brackets after the title. Published emails only.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/partners-import.ts [--apply]
 */
import { readFileSync, existsSync } from 'node:fs'
import type { CrmOrgType, CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

const DIR = `${process.env.HOME}/nc-hunter-results/2026-10-30-partners`
const apply = process.argv.includes('--apply')
const G: Record<string, { label: string; role: CrmPersonRole; orgType: CrmOrgType }> = {
  insurer: { label: 'insurer', role: 'BD_PARTNER', orgType: 'OTHER' },
  broker: { label: 'benefits broker or consultant', role: 'GTM_PARTNER', orgType: 'VENDOR' },
  bank: { label: 'bank community development or hardship', role: 'BD_PARTNER', orgType: 'OTHER' },
  retirement: { label: 'retirement and wealth firm', role: 'BD_PARTNER', orgType: 'OTHER' },
  platform: { label: 'benefits or HR platform', role: 'GTM_PARTNER', orgType: 'VENDOR' },
  investor: { label: 'investor portfolio talent', role: 'STRATEGIC', orgType: 'VC_FUND' },
}
async function main() {
  const rows: any[] = ['A', 'B', 'C', 'D'].flatMap((g) => (existsSync(`${DIR}/partners-${g}.json`) ? JSON.parse(readFileSync(`${DIR}/partners-${g}.json`, 'utf8')) : []))
  const seen = new Set<string>(); const t: Record<string, number> = { kept: 0, dropped: 0, added: 0, matched: 0, review: 0, removed: 0, withEmail: 0 }
  for (const r of rows) {
    const g = G[r.group]; const key = `${r.name}|${r.domain}`.toLowerCase()
    if (!g || !r.name || r.name.trim().split(/\s+/).length < 2 || !r.title || !r.source_url || seen.has(key)) { t.dropped++; continue }
    seen.add(key); t.kept++
    let email = (r.email || '').trim().toLowerCase()
    if (email && !email.endsWith(r.domain.split('.').slice(-2).join('.'))) email = ''
    if (email) t.withEmail++
    if (!apply) continue
    const org = await ensureOrg({ name: r.org, type: g.orgType as never, website: `https://${r.domain}` })
    const roles: CrmPersonRole[] = [g.role]
    const res = await addContactToCrm({
      fullName: r.name, title: `${r.title} [${g.label}]`, email: email || null, orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
      note: `${r.title} at ${r.org}, a ${g.label} that could sponsor, bundle or refer career-transition help for laid-off professionals. ${r.evidence_note ?? ''} Source: ${r.source_url}. Found by web research 2026-10-30; no email on a public page unless one is shown.`,
    })
    if (res.outcome === 'removed') t.removed++; else t[res.outcome]++
  }
  console.log(t); await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
