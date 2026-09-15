/**
 * One-time backfill: link every pre-existing WarnNotice to a Company using
 * the same match/create rules as matchOrCreateCompanyForEmployer (see
 * src/lib/warn/company-match.ts), which new notices get at ingestion time.
 *
 * Deliberately does NOT call that function directly — it re-fetches the
 * entire Company table on every single call, which is fine for one notice at
 * ingestion time but turns a ~1800-row backfill into ~1800 sequential
 * full-table round trips. This keeps one in-memory copy of Company and
 * updates it locally as new companies get created here, then batches the
 * WarnNotice writes — same matching rules, no per-row re-fetch.
 *
 * Usage: npx tsx --env-file=.env.local scripts/backfill-warn-company-match.ts
 */
import { prisma } from '../src/lib/prisma'
import { normalizeOrgName, orgNamesMatch, fixAllCapsCompanyName } from '../src/lib/text/org-name-match'
import { strictOrgKey } from '../src/lib/crm/normalize'

async function main() {
  const notices = await prisma.warnNotice.findMany({
    where: { companyMatchStatus: 'UNMATCHED', companyId: null },
    select: { id: true, employer: true },
  })
  console.log(`${notices.length} notices to match.`)

  const companies = await prisma.company.findMany({ select: { id: true, name: true } })
  console.log(`${companies.length} companies loaded into memory.`)

  let matched = 0
  let ambiguous = 0

  for (const [i, n] of notices.entries()) {
    const employer = fixAllCapsCompanyName(n.employer.trim())
    const strictKey = strictOrgKey(employer, normalizeOrgName)

    let companyId: string | null = null
    let status: 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED' = 'UNMATCHED'
    let candidates: { id: string; name: string }[] | null = null

    if (strictKey) {
      const strictMatch = companies.find((c) => strictOrgKey(c.name, normalizeOrgName) === strictKey)
      if (strictMatch) {
        companyId = strictMatch.id
        status = 'MATCHED'
      } else {
        const looseMatches = companies.filter((c) => orgNamesMatch(c.name, employer))
        if (looseMatches.length > 0) {
          status = 'AMBIGUOUS'
          candidates = looseMatches.map((c) => ({ id: c.id, name: c.name }))
        } else {
          const cleanName = employer.replace(/\s*\([^)]*\)\s*$/, '').trim() || employer
          const canonicalNameNormalized = normalizeOrgName(cleanName)
          const created = await prisma.company.upsert({
            where: { canonicalNameNormalized },
            update: {},
            create: { name: cleanName, canonicalNameNormalized },
          })
          companies.push({ id: created.id, name: created.name })
          companyId = created.id
          status = 'MATCHED'
        }
      }
    }

    await prisma.warnNotice.update({
      where: { id: n.id },
      data: {
        companyId,
        companyMatchStatus: status,
        ...(candidates ? { companyMatchCandidates: candidates } : {}),
      },
    })

    if (status === 'MATCHED') matched++
    else if (status === 'AMBIGUOUS') ambiguous++

    if ((i + 1) % 200 === 0) console.log(`${i + 1}/${notices.length}…`)
  }

  console.log(`Done. Matched/created: ${matched}, ambiguous (needs review): ${ambiguous}, companies now: ${companies.length}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
