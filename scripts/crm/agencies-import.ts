/**
 * Federal grant-program leaders, state reemployment/UI leaders and policy-influence people, researched from official public pages
 * (~/nc-hunter-results/2026-10-30-categories/agencies-*.json). Each person gets the contact type that says what they are
 * (federal: Grants; state agency: Business Dev Partner; policy: Connector) and the kind in brackets after the title.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/agencies-import.ts [--apply]
 */
import { readFileSync, existsSync } from 'node:fs'
import type { CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

const DIR = `${process.env.HOME}/nc-hunter-results/2026-10-30-categories`
const apply = process.argv.includes('--apply')
const FILES: [string, CrmPersonRole, string][] = [['agencies-federal.json', 'GRANTS', 'federal grant program'], ['agencies-state.json', 'BD_PARTNER', 'state reemployment and unemployment insurance'], ['agencies-policy.json', 'CONNECTOR', 'policy']]

async function main() {
  const t: Record<string, number> = { kept: 0, dropped: 0, added: 0, matched: 0, review: 0, removed: 0, withEmail: 0 }
  const by: Record<string, number> = {}; const seen = new Set<string>()
  for (const [file, role, kind] of FILES) {
    if (!existsSync(`${DIR}/${file}`)) continue
    for (const r of JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as any[]) {
      const key = `${r.name}|${r.org}`.toLowerCase()
      if (!r.name || r.name.trim().split(/\s+/).length < 2 || !r.title || !r.org || !r.source_url || seen.has(key)) { t.dropped++; continue }
      seen.add(key); t.kept++; by[kind] = (by[kind] ?? 0) + 1
      let email = (r.email || '').trim().toLowerCase()
      if (email && r.domain && !email.endsWith(r.domain.split('.').slice(-2).join('.'))) email = ''
      if (email) t.withEmail++
      if (!apply) continue
      const org = await ensureOrg({ name: r.org, type: 'GOVERNMENT' as never, website: r.domain ? `https://${r.domain}` : undefined })
      const roles: CrmPersonRole[] = [role]
      const res = await addContactToCrm({
        fullName: r.name, title: `${r.title} [${kind}]`, email: email || null, orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
        note: `${r.title} at ${r.org}: ${kind}. ${r.evidence_note ?? ''} Source: ${r.source_url}. Found by web research 2026-10-30.`,
      })
      if (res.outcome === 'removed') t.removed++; else t[res.outcome]++
    }
  }
  console.log(t, by); await prisma.$disconnect()
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
