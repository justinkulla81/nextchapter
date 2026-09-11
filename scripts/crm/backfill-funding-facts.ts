/**
 * Fills funder kind, what-you-get, state and preconditions from the source sheet.
 *
 *   npm run crm:funding-facts -- --dir <csv dir>
 *   npm run crm:funding-facts -- --dir <csv dir> --commit
 *
 * "VC fund" was doing too much work on the org type: a federal grant, a rolling
 * credits programme and an angel are not the same pursuit. These fields split
 * them apart from data already in the sheet rather than asking for it again.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { strictOrgKey } from '../../src/lib/crm/normalize'
import { funderKindFrom, valueTypesFrom, usStateFrom } from '../../src/lib/crm/funding'
import { toRows } from './parse'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const DIR = (() => {
  const i = process.argv.indexOf('--dir')
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : join(process.cwd(), '.crm-sources')
})()

/** Rough days to satisfy a stated precondition, from how it is worded. */
function leadTimeFor(text: string): number | null {
  const t = text.toLowerCase()
  if (!t.trim()) return null
  // Establishing a physical or legal presence somewhere is the slow one.
  if (/nexus|presence|based in|relocat|incorporat|establish/.test(t)) return 180
  // Needing another award first means a whole prior cycle.
  if (/prior|after a federal|post-federal|must first|following a/.test(t)) return 270
  if (/academic partner|university|research partner/.test(t)) return 90
  if (/accelerator|partner org|provider id|via a partner/.test(t)) return 60
  if (/nomination|referral|invite/.test(t)) return 30
  return null
}

async function main() {
  console.log(`FUNDING FACTS — ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)
  const path = join(DIR, 'funding.csv')
  if (!existsSync(path)) { console.error(`missing ${path}`); process.exit(1) }

  const rows = toRows(readFileSync(path, 'utf8'))
  const orgs = await prisma.crmOrganization.findMany({ select: { id: true, name: true } })
  const byStrict = new Map(orgs.map((o) => [strictOrgKey(o.name, normalizeOrgName), o.id]))

  let kinds = 0, values = 0, states = 0, preconds = 0, missing = 0
  const kindTally = new Map<string, number>()
  const valueTally = new Map<string, number>()
  const stateTally = new Map<string, number>()

  for (const r of rows) {
    const orgName = r.get('Organization')
    if (!orgName) continue
    const orgId = byStrict.get(strictOrgKey(orgName, normalizeOrgName))
    if (!orgId) { missing++; continue }

    const kind = funderKindFrom(r.get('Category'), orgName)
    const vals = valueTypesFrom(r.get('Money / Value'), r.get('Check Size'))
    const state = usStateFrom(r.get('Geography'))

    // Preconditions are stated across three columns in the sheet; join what is
    // there rather than picking one and losing the rest.
    const pre = [
      r.get('Traction Needed'),
      /requir|nexus|must|only if|eligib/i.test(r.get('Verification / Note') ?? '') ? r.get('Verification / Note') : null,
    ].filter(Boolean).join(' · ') || null
    const lead = pre ? leadTimeFor(pre) : null

    if (kind) { kinds++; kindTally.set(kind, (kindTally.get(kind) ?? 0) + 1) }
    for (const v of vals) valueTally.set(v, (valueTally.get(v) ?? 0) + 1)
    if (vals.length > 0) values++
    if (state) { states++; stateTally.set(state, (stateTally.get(state) ?? 0) + 1) }
    if (pre) preconds++

    if (!COMMIT) continue

    if (state) {
      await prisma.crmOrganization.update({ where: { id: orgId }, data: { usState: state } })
    }
    await prisma.crmInvestorProfile.upsert({
      where: { orgId },
      create: {
        orgId, funderKind: kind, valueTypes: vals,
        preconditions: pre, preconditionLeadTimeDays: lead,
      },
      update: {
        funderKind: kind ?? undefined,
        valueTypes: vals.length > 0 ? vals : undefined,
        preconditions: pre ?? undefined,
        preconditionLeadTimeDays: lead ?? undefined,
      },
    })
  }

  const show = (title: string, m: Map<string, number>) => {
    console.log(`\n${title}`)
    for (const [k, n] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(22)}${String(n).padStart(5)}`)
    }
  }
  console.log(`\nrows ${rows.length} · matched ${rows.length - missing} · unmatched ${missing}`)
  console.log(`funder kind set ${kinds} · value types ${values} · state ${states} · preconditions ${preconds}`)
  show('FUNDER KIND', kindTally)
  show('WHAT YOU GET', valueTally)
  show('STATE', stateTally)
  if (!COMMIT) console.log('\nDry run — nothing written. Re-run with --commit.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
