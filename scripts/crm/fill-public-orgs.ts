/**
 * Puts every workforce board, American Job Center, economic development district, local economic
 * development organization and state economic development agency from our directories into the CRM
 * as a government organization, so each has a record to link its public page from. Only organizations
 * the CRM does not already hold (same normalized name) are added; nothing existing is changed.
 * Local organizations with low confidence in the partner table are skipped.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/fill-public-orgs.ts [--apply]
 *
 * Without --apply it only counts what it would add. No people are added: the directories give
 * organizations, and contact details stay out of the public pages.
 */
import { prisma } from '../../src/lib/prisma'
import { ensureOrg } from '../../src/lib/crm/add-contact'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'

// "Kentucky River Area Development District (KY DLG/Gold)" and "(listed by EDAA)" are source tags, not part of the name.
const cleanName = (n: string) => n.replace(/\s*\((listed by[^)]*|[A-Z]{2} DLG\/[^)]*)\)\s*$/i, '').replace(/\s+/g, ' ').trim()

interface Candidate { name: string; state: string; website: string | null; city: string | null; group: string }

async function main() {
  const apply = process.argv.includes('--apply')
  const have = new Set((await prisma.crmOrganization.findMany({ select: { canonicalNameNormalized: true } })).map((o) => o.canonicalNameNormalized))
  const found: Candidate[] = []

  for (const b of await prisma.workforceBoard.findMany({ select: { name: true, state: true, website: true } })) {
    found.push({ name: b.name, state: b.state, website: b.website, city: null, group: 'board' })
  }
  for (const c of await prisma.americanJobCenter.findMany({ select: { name: true, state: true, city: true } })) {
    found.push({ name: c.name, state: c.state, website: null, city: c.city, group: 'job center' })
  }
  for (const p of await prisma.localPartnerOrg.findMany({ where: { OR: [{ confidence: null }, { confidence: { not: 'low' } }] }, select: { name: true, state: true, website: true, city: true, kind: true } })) {
    found.push({ name: cleanName(p.name), state: p.state, website: p.website, city: p.city, group: p.kind === 'EDD' ? 'EDD' : p.kind === 'STATE_AGENCY' ? 'state agency' : 'local EDO' })
  }

  const tally = new Map<string, { seen: number; added: number }>()
  const queued = new Set<string>()
  const todo: Candidate[] = []
  for (const c of found) {
    const t = tally.get(c.group) ?? { seen: 0, added: 0 }
    t.seen++
    // Job centers were imported earlier with the state in the name; count that form as present too.
    const key = normalizeOrgName(c.name)
    const keyWithState = normalizeOrgName(`${c.name} (${c.state})`)
    if (!have.has(key) && !have.has(keyWithState) && !queued.has(key)) {
      queued.add(key)
      t.added++
      todo.push(c)
    }
    tally.set(c.group, t)
  }
  console.log(apply ? 'APPLYING' : 'DRY RUN (no writes)')
  for (const [g, t] of tally) console.log(`${g.padEnd(14)} in directory ${String(t.seen).padStart(5)}   to add ${String(t.added).padStart(5)}`)
  console.log(`total to add: ${todo.length}`)
  if (!apply) return

  let done = 0
  for (const c of todo) {
    await ensureOrg({ name: c.name, type: 'GOVERNMENT', website: c.website, city: c.city, state: c.state })
    if (++done % 200 === 0) console.log(`  ${done}/${todo.length}`)
  }
  console.log(`added ${done} organizations`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => process.exit(0))
