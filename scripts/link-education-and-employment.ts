// One-off catch-up for resumes uploaded before education and jobs were linked to
// canonical records. Future resumes are linked as they are parsed; this brings the
// existing ones level.
//
//   1. seed the well-known institutions
//   2. link every education entry to one canonical School (+ degree level)
//   3. link every job to its directory company
//   4. --reextract: re-read each member's latest resume in entries-only mode, which
//      picks up jobs and schools skipped under the old caps and keeps undated jobs.
//      Entries-only never touches the profile, so nothing a member edited by hand is
//      overwritten. Costs ~$0.003 per resume (Haiku).
//
// Idempotent; safe to re-run.
//
// Run: node --env-file=.env.local --conditions=react-server --import tsx scripts/link-education-and-employment.ts [--reextract]

import { prisma } from '../src/lib/prisma'
import { ensureSchoolsSeeded, linkAllEducation } from '../src/lib/education/school-link'
import { linkPostingToCompany } from '../src/lib/companies/posting-company'
import { extractProfileFieldsFromResume } from '../src/lib/resume/extract-profile-fields'

async function linkJobs() {
  let linked = 0
  const names = await prisma.workHistoryEntry.groupBy({ by: ['companyName'], where: { companyId: null } })
  for (const { companyName } of names) {
    const companyId = await linkPostingToCompany(companyName)
    if (!companyId) continue
    const { count } = await prisma.workHistoryEntry.updateMany({ where: { companyId: null, companyName }, data: { companyId } })
    linked += count
  }
  const undated = await prisma.undatedEmployment.groupBy({ by: ['companyName'], where: { companyId: null } })
  for (const { companyName } of undated) {
    const companyId = await linkPostingToCompany(companyName)
    if (!companyId) continue
    await prisma.undatedEmployment.updateMany({ where: { companyId: null, companyName }, data: { companyId } })
  }
  return linked
}

async function main() {
  const reextract = process.argv.includes('--reextract')
  await ensureSchoolsSeeded()
  console.log('schools seeded')

  const edu = await linkAllEducation()
  console.log('education:', JSON.stringify(edu))

  const jobs = await linkJobs()
  console.log('jobs linked to a company:', jobs)

  if (reextract) {
    // Latest resume per real member.
    const latest = await prisma.resume.findMany({
      where: { extractedText: { not: null }, candidate: { isSystemAccount: false, isSampleData: false } },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, candidateId: true },
    })
    const seen = new Set<string>()
    const resumes = latest.filter((r) => (seen.has(r.candidateId) ? false : (seen.add(r.candidateId), true)))
    const before = await prisma.$queryRaw<{ e: bigint; w: bigint; u: bigint }[]>`
      select (select count(*) from "EducationEntry") e, (select count(*) from "WorkHistoryEntry") w, (select count(*) from "UndatedEmployment") u`
    for (const r of resumes) {
      await extractProfileFieldsFromResume(r.id, { entriesOnly: true })
    }
    const after = await prisma.$queryRaw<{ e: bigint; w: bigint; u: bigint }[]>`
      select (select count(*) from "EducationEntry") e, (select count(*) from "WorkHistoryEntry") w, (select count(*) from "UndatedEmployment") u`
    console.log(`re-read ${resumes.length} resumes (entries only):`, {
      education: [Number(before[0].e), Number(after[0].e)],
      jobs: [Number(before[0].w), Number(after[0].w)],
      undated: [Number(before[0].u), Number(after[0].u)],
    })
    // The re-read may have created new schools/jobs: link whatever is still loose.
    console.log('education (pass 2):', JSON.stringify(await linkAllEducation()))
    console.log('jobs (pass 2):', await linkJobs())
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
