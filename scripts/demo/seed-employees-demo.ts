// Sample Employees section (Retention, and Learning and development) on the Meridian Health sample employer, so the
// employer pages and the employee side can be clicked through end to end. Everything is sample data: the org, the
// contracts, the seats, courses, progress and interest rows are isSampleData, and the people are existing sample
// candidate profiles. Re-running it does nothing once the Retention contract exists.
//   npx tsx scripts/demo/seed-employees-demo.ts
import { prisma } from '../../src/lib/prisma'
import { INTERNAL_ROLE_SOURCE, INTERNAL_ROLE_STATUS } from '../../src/lib/employer/staff-programs'

const DAY = 24 * 60 * 60 * 1000
const ago = (d: number) => new Date(Date.now() - d * DAY)

async function main() {
  const org = await prisma.outplacementEmployerOrg.findFirst({ where: { name: 'Meridian Health', isSampleData: true }, select: { id: true, name: true, contracts: { select: { programType: true, createdBy: true } } } })
  if (!org) throw new Error('No Meridian Health sample org.')
  if (org.contracts.some((c) => c.programType === 'GROWTH')) return console.log('Already seeded.')
  const createdBy = org.contracts[0]?.createdBy ?? 'seed-employees-demo'

  const seated = (await prisma.outplacementSeat.findMany({ where: { candidateId: { not: null } }, select: { candidateId: true } })).map((s) => s.candidateId as string)
  const people = await prisma.candidateProfile.findMany({ where: { isSampleData: true, id: { notIn: seated } }, select: { id: true, firstName: true, lastName: true }, orderBy: { createdAt: 'asc' }, take: 24 })
  if (people.length < 24) throw new Error(`Only ${people.length} unseated sample profiles.`)
  const team = (i: number) => (i < 12 ? 'Nursing' : 'Finance and revenue cycle')

  const contract = (programType: 'GROWTH' | 'LEARNING') =>
    prisma.outplacementContract.create({
      data: { orgId: org.id, programType, tier: 'PLUS', seatCount: 30, termStartAt: ago(60), termEndAt: new Date(Date.now() + 305 * DAY), cohortLabel: 'Sample: current employees', createdBy, isSampleData: true },
    })
  const [retention, learning] = [await contract('GROWTH'), await contract('LEARNING')]

  for (const [i, p] of people.entries()) {
    for (const c of [retention, learning]) {
      await prisma.outplacementSeat.create({
        data: {
          contractId: c.id, invitedEmail: `sample+meridian-${i}@example.com`, invitedName: [p.firstName, p.lastName].filter(Boolean).join(' ') || null,
          status: i < 22 ? 'ACTIVATED' : 'INVITED', candidateId: i < 22 ? p.id : null, activatedAt: i < 22 ? ago(50 - i) : null,
          cohort: team(i), shareOutcomeWithEmployer: i % 2 === 0, isSampleData: true, enrolledAt: ago(55),
        },
      })
    }
  }
  const joined = people.slice(0, 22)

  // Retention activity on the employee side.
  for (const [i, p] of joined.entries()) {
    if (i % 4 !== 3) await prisma.dailyCheckIn.create({ data: { candidateId: p.id, mood: 'MOVING', checkedInAt: ago(i % 20) } })
    if (i < 16) await prisma.inWorkProfile.upsert({ where: { candidateId: p.id }, create: { candidateId: p.id }, update: {} })
    if (i < 12) await prisma.inWorkWin.create({ data: { candidateId: p.id, what: 'Sample win', result: 'Sample result', occurredOn: ago(10 + i) } })
    if (i < 14) await prisma.inWorkPrep.upsert({ where: { candidateId_cycleKey: { candidateId: p.id, cycleKey: '2026-H2' } }, create: { candidateId: p.id, cycleKey: '2026-H2', completedAt: i < 9 ? ago(5) : null }, update: {} })
    if (i < 11) await prisma.inWorkPromotionPlan.upsert({ where: { candidateId: p.id }, create: { candidateId: p.id, targetLevel: 'Next level' }, update: {} })
    if (i % 2 === 0 && i < 20) await prisma.inWorkOutcome.create({ data: { candidateId: p.id, reviewedOn: ago(30), raiseReceived: i % 4 === 0, raisePercent: i % 4 === 0 ? 4 : null, promoted: i % 8 === 0 } })
  }

  const roles = [
    { title: 'Nurse manager, cardiac step-down', location: 'Louisville, KY', description: 'Lead a 28-bed unit. Open to charge nurses with two or more years in the role.' },
    { title: 'Revenue cycle analyst II', location: 'Hybrid, Louisville, KY', description: 'Own denial trends for two payers and work with the coding team on fixes.' },
    { title: 'Clinical informatics specialist', location: 'Remote', description: 'Bridge nursing and the EHR team. Nursing background required.' },
  ]
  const postings = []
  for (const [i, r] of roles.entries()) {
    postings.push(
      await prisma.exclusiveJobPosting.create({
        data: { ...r, companyName: org.name, url: `https://launchyournextchapter.com/dashboard/internal-roles#nc-internal-sample-${org.id}-${i}`, addedBy: 'seed-employees-demo', status: INTERNAL_ROLE_STATUS, source: INTERNAL_ROLE_SOURCE, distribution: 'EXCLUDED', orgScopeId: org.id, archivedAt: i === 2 ? ago(3) : null },
      })
    )
  }
  for (const [i, p] of joined.slice(0, 5).entries()) {
    await prisma.internalRoleInterest.create({ data: { postingId: postings[i % 2].id, candidateId: p.id, note: i === 0 ? 'Charge nurse on 4 West for three years.' : null, isSampleData: true } })
  }

  const courses = [
    { title: 'Google Data Analytics Certificate', provider: 'Coursera', skills: ['SQL', 'Spreadsheets', 'Tableau'], covered: 'Fully covered' },
    { title: 'Certified Revenue Cycle Representative', provider: 'HFMA', skills: ['Revenue cycle', 'Denials management'], covered: 'Fully covered' },
    { title: 'Nurse leadership essentials', provider: 'AONL', skills: ['Leadership', 'Staffing'], covered: 'Up to $500' },
    { title: 'AI for healthcare operations', provider: 'NextChapter', skills: ['AI tools', 'Process improvement'], covered: 'Fully covered' },
  ]
  const made = []
  for (const c of courses) made.push(await prisma.orgCourse.create({ data: { orgId: org.id, ...c, isSampleData: true } }))
  for (const [i, p] of joined.entries()) {
    if (i >= 15) continue
    await prisma.orgCourseProgress.create({ data: { courseId: made[i % made.length].id, candidateId: p.id, status: i < 6 ? 'COMPLETED' : 'STARTED', isSampleData: true } })
  }
  console.log(`Seeded ${org.name}: 2 contracts, ${people.length * 2} seats (${joined.length} joined per program), ${postings.length} internal roles, ${made.length} courses.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
