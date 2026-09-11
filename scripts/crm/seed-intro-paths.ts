/**
 * Backfills intro paths from the funding sheet's warm-path column.
 *
 *   npm run crm:seed-paths              # dry run
 *   npm run crm:seed-paths -- --commit
 *
 * The sheet holds a single free-text "Warm Path if No 1st-Degree" cell per
 * funder, of the form "Route via Rick Robinson (AARP) or Max Zamkow (Third
 * Act)". That's real intelligence trapped in prose — unsearchable, and with no
 * way to record that an ask was already made. This turns each named connector
 * into a CrmIntroPath, linked to their CRM record where one exists.
 *
 * Targets the ORGANISATION. Every routable note in the sheet is organisation
 * level — "route via Rick Robinson to reach Primetime Partners" — because a
 * firm you have no contact at is exactly the firm that needs a route. An
 * earlier version attached paths to the funder's primary contact and produced
 * zero rows for that reason.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { strictOrgKey } from '../../src/lib/crm/normalize'
import { toRows, cleanPersonName } from './parse'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const DIR = (() => {
  const i = process.argv.indexOf('--dir')
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : join(process.cwd(), '.crm-sources')
})()

/**
 * Words that mark a capitalised phrase as an organisation rather than a person.
 * Without this the extractor happily proposes "AARP AgeTech Collaborative" and
 * "Third Act" as connectors, because a firm name in title case looks exactly
 * like a person's name to a regex.
 */
const ORG_WORDS = /\b(ventures?|capital|partners?|fund|funds|collaborative|institute|foundation|network|group|labs?|llc|inc|corp|university|college|school|associates|advisors?|holdings|management|equity|angels?|accelerator|program|initiative)\b/i
const SENTENCE_LEAD = /^(Route|Via|No|None|Ask|Use|Get|The|Their|Both|Fold|Coordinate|Approach|Direct|Cold|Relationship|Deprioritise|Deprioritize|Several|Overlapping|Alternatively|Different|Worth)\b/i

/** Pulls candidate person names out of a prose routing note. */
function namesIn(note: string, knownOrgNames: Set<string>): string[] {
  const out = new Set<string>()
  // "Route via Rick Robinson (AARP) or Max Zamkow (Third Act)"
  for (const m of note.matchAll(/\b([A-Z][a-zA-Z.'’-]+(?:\s+[A-Z][a-zA-Z.'’-]+){1,2})\b/g)) {
    const n = cleanPersonName(m[1])
    if (!n) continue
    if (SENTENCE_LEAD.test(n)) continue
    if (n.split(' ').length < 2) continue
    if (ORG_WORDS.test(n)) continue
    const lower = n.toLowerCase()
    // Also reject a PREFIX of a known organisation: notes shorten "Third Act
    // Ventures" to "Third Act", which exact matching misses.
    if (knownOrgNames.has(lower)) continue
    if ([...knownOrgNames].some((o) => o.startsWith(`${lower} `))) continue
    out.add(n)
  }
  return [...out]
}

async function main() {
  console.log(`INTRO PATH SEED — ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)
  const path = join(DIR, 'funding.csv')
  if (!existsSync(path)) { console.error(`missing ${path}`); process.exit(1) }

  const rows = toRows(readFileSync(path, 'utf8'))
  const orgs = await prisma.crmOrganization.findMany({ select: { id: true, name: true, canonicalNameNormalized: true } })
  const byStrict = new Map(orgs.map((o) => [strictOrgKey(o.name, normalizeOrgName), o.id]))
  // Every organisation name we know, so a firm in a routing note is never
  // mistaken for a connector.
  const knownOrgNames = new Set(orgs.map((o) => o.name.toLowerCase()))

  let planned = 0, linked = 0, freeText = 0
  const samples: string[] = []

  for (const r of rows) {
    const note = r.get('Warm Path if No 1st-Degree')
    const orgName = r.get('Organization')
    if (!note || !orgName) continue
    if (/^n\/a|^none|1st degree/i.test(note)) continue

    const orgId = byStrict.get(strictOrgKey(orgName, normalizeOrgName))
    if (!orgId) continue

    for (const name of namesIn(note, knownOrgNames)) {
      const connector = await prisma.crmPerson.findFirst({
        where: { fullName: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      })
      const dupe = await prisma.crmIntroPath.findFirst({
        where: {
          targetOrgId: orgId,
          ...(connector ? { connectorPersonId: connector.id } : { connectorName: name }),
        },
      })
      if (dupe) continue

      planned++
      if (connector) linked++; else freeText++
      if (samples.length < 12) {
        samples.push(`  ${orgName} ← ${name}${connector ? ' [linked]' : ' [name only]'}`)
      }
      if (COMMIT) {
        await prisma.crmIntroPath.create({
          data: {
            targetOrgId: orgId,
            connectorPersonId: connector?.id ?? null,
            connectorName: connector ? null : name,
            relationshipNote: note.slice(0, 400),
            strength: connector ? 'MEDIUM' : 'UNVERIFIED',
          },
        })
      }
    }
  }

  console.log(`\n${COMMIT ? 'created' : 'would create'} ${planned} intro paths`)
  console.log(`  linked to a CRM record : ${linked}`)
  console.log(`  name only              : ${freeText}`)
  if (samples.length) { console.log('\nsamples'); samples.forEach((s) => console.log(s)) }
  if (!COMMIT) console.log('\nDry run — nothing written. Re-run with --commit.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
