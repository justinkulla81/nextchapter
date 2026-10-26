/**
 * Gives every college (CollegeProfile + LocalCollege, one per IPEDS id) a CRM organization, so its public page
 * (/higher-education/<state>/<college>) and its CRM record point at each other. Dry run by default: prints what it
 * would do and writes nothing. Needs prisma/manual/2026-10-25-college-org-link.sql applied before --apply.
 *
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/colleges/link-crm.ts
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/colleges/link-crm.ts --apply
 *
 * A college already linked or already decided on the Review List is left alone. Similar names and same-website
 * different-name matches go to the Review List (CRM → Review List → Colleges), never linked on a guess.
 */
import { prisma } from '@/lib/prisma'
import type { OrgForMatch } from '@/lib/search-firms/match'
import { createCollegeOrg, existingLinks, loadCollegesToLink, planCollegeLink, recordLink, recordReview, tagUniversity } from '@/lib/workforce/college-org-link'

async function main() {
  const apply = process.argv.includes('--apply')
  const colleges = await loadCollegesToLink()
  const orgs: OrgForMatch[] = await prisma.crmOrganization.findMany({ select: { id: true, name: true, website: true, emailDomain: true } })
  const prior = await existingLinks()
  const count = { matched: 0, review: 0, add: 0, skipped: 0 }
  const samples: Record<string, string[]> = { matched: [], review: [], add: [] }
  for (const c of colleges) {
    const p = prior.get(c.unitid)
    if (p && (p.crmOrgId || p.matchStatus === 'REVIEW')) { count.skipped++; continue }
    const plan = planCollegeLink(c, orgs)
    count[plan.kind]++
    if (samples[plan.kind].length < 8) samples[plan.kind].push(plan.kind === 'review' ? `${c.name} (${c.state}) → ${plan.reason}` : `${c.name} (${c.state})`)
    if (!apply) continue
    if (plan.kind === 'matched') { await tagUniversity(plan.orgId); await recordLink(c.unitid, plan.orgId, 'MATCHED') }
    else if (plan.kind === 'review') await recordReview(c.unitid, plan.orgId, plan.reason)
    else {
      const id = await createCollegeOrg(c)
      orgs.push({ id, name: c.name, website: c.website, emailDomain: null })
      await recordLink(c.unitid, id, 'ADDED')
    }
  }
  console.log(apply ? 'APPLIED' : 'DRY RUN (nothing written)', { colleges: colleges.length, ...count })
  for (const [k, v] of Object.entries(samples)) console.log(`\n${k} (sample):\n  ${v.join('\n  ')}`)
}

main().finally(() => prisma.$disconnect())
