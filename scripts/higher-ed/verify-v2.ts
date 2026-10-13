// V2 programs, against the real database on a throwaway college deleted at
// the end: programs and cohorts, applying (seat limit, no duplicates),
// enrolling and completing (credential, engagement), employer-paid seats
// counted against a client, capstones, and the WIOA report (placement only
// within 180 days after completion).
//
//   npm run verify:v2
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import { addCohort, applyToCohort, listClients, openCohorts, proposeCapstone, saveClient, saveProgram, updateCapstone, updateEnrollment, wioaReport } from '../../src/lib/higher-ed/programs'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

const tag = `v2test${randomUUID().slice(0, 8)}`
const DAY = 86_400_000

async function main() {
  const inst = await prisma.institution.create({ data: { slug: tag, name: 'V2 Test College', isDemo: true, isSampleData: true, enabledFeatures: { wioa: true } }, select: { id: true } })
  try {
    const now = new Date()
    const mk = (n: string) => prisma.institutionMember.create({ data: { institutionId: inst.id, email: `${n}@${tag}.test`, firstName: n }, select: { id: true } })
    const [a, b, c] = await Promise.all([mk('ann'), mk('bo'), mk('cy')])
    const p = await saveProgram({ institutionId: inst.id, name: 'Data analytics', summary: null, audience: null, credential: 'Data Analytics Certificate', priceCents: 100_000, wioaEligible: true, isActive: true, createdBy: 'verify' })
    const programId = (p as { id: string }).id
    const ch = await addCohort({ institutionId: inst.id, programId, name: 'Fall', startsAt: new Date(now.getTime() + 10 * DAY), endsAt: null, seats: 2, modality: 'online', facultyUserId: null })
    const cohortId = (ch as { id: string }).id

    const r1 = await applyToCohort({ institutionId: inst.id, memberId: a.id, cohortId, payer: 'HELP', note: 'Recently laid off' })
    const dup = await applyToCohort({ institutionId: inst.id, memberId: a.id, cohortId, payer: 'SELF_PAY', note: '' })
    await applyToCohort({ institutionId: inst.id, memberId: b.id, cohortId, payer: 'EMPLOYER', note: '' })
    const full = await applyToCohort({ institutionId: inst.id, memberId: c.id, cohortId, payer: 'SELF_PAY', note: '' })
    check('Apply once; a full cohort refuses and disappears', ['id' in r1, 'error' in dup, 'error' in full, (await openCohorts(inst.id)).length], [true, true, true, 0])
    const ea = await prisma.enrollment.findUniqueOrThrow({ where: { id: (r1 as { id: string }).id }, select: { note: true, payer: true } })
    check('"I need help paying" is a note, payer left for staff', ea, { note: 'Needs help paying. Recently laid off', payer: 'SELF_PAY' })

    // Staff: Ann on a WIOA voucher, enrolled then completed long enough ago to count.
    const aId = (r1 as { id: string }).id
    await updateEnrollment({ institutionId: inst.id, enrollmentId: aId, payer: 'WIOA_VOUCHER' })
    await updateEnrollment({ institutionId: inst.id, enrollmentId: aId, status: 'ENROLLED' })
    const completedAt = new Date(now.getTime() - 200 * DAY)
    await updateEnrollment({ institutionId: inst.id, enrollmentId: aId, status: 'COMPLETED', now: completedAt })
    const done = await prisma.enrollment.findUniqueOrThrow({ where: { id: aId }, select: { status: true, credentialName: true, enrolledAt: true } })
    check('Completing records the credential', [done.status, done.credentialName, !!done.enrolledAt], ['COMPLETED', 'Data Analytics Certificate', true])
    check('Completion scores for engagement once', await prisma.engagementEvent.count({ where: { memberId: a.id, sourceTable: 'Enrollment' } }), 1)

    let w = await wioaReport(inst.id, now)
    check('Completed 200 days ago, no job: counts, not placed, rate 0', [w.enrolled, w.completed, w.placed, w.placementRate], [1, 1, 0, 0])
    await prisma.outcomeReport.create({ data: { memberId: a.id, reportedAt: new Date(completedAt.getTime() + 400 * DAY) } })
    w = await wioaReport(inst.id, now)
    check('A job after the 180-day window isn’t a placement', w.placed, 0)
    await prisma.outcomeReport.create({ data: { memberId: a.id, reportedAt: new Date(completedAt.getTime() + 90 * DAY) } })
    w = await wioaReport(inst.id, now)
    check('A job within 180 days is', [w.placed, w.placementRate, w.rows[0].placedAt?.toISOString()], [1, 1, new Date(completedAt.getTime() + 90 * DAY).toISOString()])

    // Employer seat against a client.
    const client = await saveClient({ institutionId: inst.id, name: 'Acme', contactName: null, contactEmail: null, seatsPurchased: 5, notes: null })
    const eb = await prisma.enrollment.findFirstOrThrow({ where: { memberId: b.id }, select: { id: true } })
    await updateEnrollment({ institutionId: inst.id, enrollmentId: eb.id, payer: 'EMPLOYER', corporateClientId: (client as { id: string }).id })
    check('Employer seat counts against the client', (await listClients(inst.id)).map((x) => [x.seatsPurchased, x.seatsUsed]), [[5, 1]])
    const foreign = await updateEnrollment({ institutionId: inst.id, enrollmentId: eb.id, payer: 'EMPLOYER', corporateClientId: 'not-a-client' })
    check('Can’t bill another college’s client', 'error' in foreign, true)

    // Capstone lifecycle.
    const cap = await proposeCapstone({ institutionId: inst.id, institutionEmployerId: null, employerName: 'Acme', title: 'Churn', brief: 'Predict churn from account data.', term: null, interviewCommitments: 99, proposedBy: 'verify' })
    await updateCapstone({ institutionId: inst.id, id: cap.id, status: 'APPROVED' })
    const capRow = await prisma.capstone.findUniqueOrThrow({ where: { id: cap.id }, select: { status: true, decidedAt: true, interviewCommitments: true } })
    check('Capstone approved, decision dated, interviews capped', [capRow.status, !!capRow.decidedAt, capRow.interviewCommitments], ['APPROVED', true, 50])
  } finally {
    await prisma.institution.delete({ where: { id: inst.id } }).catch(() => {})
    await prisma.$disconnect()
  }
  console.log(`${passed} passed, ${failures.length} failed (test college deleted)`)
  for (const f of failures) console.log('  FAIL ' + f)
  if (failures.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
