// NextChapter Talent end-to-end check against the live database.
// Run with: npm run verify:talent-intake
//
// Creates a throwaway, clearly-labeled test firm (slug nc-verify-<ts>,
// status PENDING so no public page ever serves it), two recruiters with
// specialties and an open search, then runs real resumes through the real
// pipeline (one Haiku call each) and checks tags, routing, reply drafts,
// visibility and the sending switch. Deletes everything it created at the
// end, pass or fail.
//
// Unlike verify-recruiter-phase6 this calls the production functions on
// purpose: the pure rules already have unit tests
// (src/test/recruiter-intake.test.ts); this script checks the wiring.

import { prisma } from '@/lib/prisma'
import { ingestIntake, processIntakeResume } from '@/lib/recruiter/intake/pipeline'
import { visibleConnectionsWhere } from '@/lib/recruiter/intake/visibility'
import { sendApprovedReply } from '@/lib/recruiter/intake/replies'
import { createAdminClient } from '@/lib/supabase/admin'

const results: { name: string; ok: boolean; detail?: string }[] = []
const check = (name: string, ok: boolean, detail?: string) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

// Minimal valid PDF with one text line per entry, built by hand so the
// script needs no PDF library.
function makePdf(lines: string[]): Buffer {
  const esc = (t: string) => t.replace(/[\\()]/g, (m) => `\\${m}`)
  const content = `BT /F1 11 Tf 50 760 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

const CFO = [
  'Dana Whitfield',
  'dana.whitfield.ncverify@example.com | Boston, MA | linkedin.com/in/dana-whitfield-ncverify',
  'Chief Financial Officer, Brightwell Health (healthcare services), 2019 - present',
  'Led IPO readiness, FP&A, and three acquisitions; $400M revenue.',
  'VP Finance, Carelink Systems (healthcare services), 2014 - 2019',
  'Controller, Mercer & Stone, 2008 - 2014',
  'MBA, Boston University. CPA.',
]
const MARKETER = [
  'Leo Park',
  'leo.park.ncverify@example.com | Austin, TX',
  'Marketing Manager, Shopline (retail ecommerce), 2021 - present',
  'Ran SEO and paid social for a $20M online store.',
  'Marketing Associate, Trailhead Goods (retail), 2018 - 2021',
  'BA, University of Texas.',
]
const FINANCE_MANAGER = [
  'Priya Raman',
  'priya.raman.ncverify@example.com | Hartford, CT',
  'Finance Manager, Northgate Insurance (insurance), 2020 - present',
  'Owns budgeting and forecasting for a 200-person division.',
  'Senior Financial Analyst, Northgate Insurance, 2016 - 2020',
  'BS Finance, UConn.',
]

async function main() {
  const startedAt = new Date()
  const stamp = Date.now()
  const firm = await prisma.recruiterFirm.create({
    data: { name: `NC Verify Firm ${stamp}`, slug: `nc-verify-${stamp}`, status: 'PENDING', intakeRoutingMode: 'AUTO', intakeMinLevel: 'Director', intakeDailyParseCap: 10 },
  })
  const jane = await prisma.recruiter.create({
    data: { fullName: 'Jane Verify', workEmail: `jane.${stamp}@ncverify.example.com`, recruiterFirmId: firm.id, firmRole: 'ADMIN', intakeSlug: 'jane', isSampleData: true },
  })
  const raj = await prisma.recruiter.create({
    data: { fullName: 'Raj Verify', workEmail: `raj.${stamp}@ncverify.example.com`, recruiterFirmId: firm.id, firmRole: 'RECRUITER', intakeSlug: 'raj', isSampleData: true },
  })
  const coordinator = await prisma.recruiter.create({
    data: { fullName: 'Cory Verify', workEmail: `cory.${stamp}@ncverify.example.com`, recruiterFirmId: firm.id, firmRole: 'COORDINATOR', isSampleData: true },
  })
  const finance = await prisma.intakeSpecialty.create({ data: { firmId: firm.id, type: 'FUNCTION', name: 'Finance' } })
  const healthcare = await prisma.intakeSpecialty.create({ data: { firmId: firm.id, type: 'INDUSTRY', name: 'Healthcare' } })
  const marketing = await prisma.intakeSpecialty.create({ data: { firmId: firm.id, type: 'FUNCTION', name: 'Marketing' } })
  await prisma.recruiterIntakeSpecialty.createMany({
    data: [
      { recruiterId: jane.id, specialtyId: finance.id, weight: 'PRIMARY' },
      { recruiterId: jane.id, specialtyId: healthcare.id, weight: 'SECONDARY' },
      { recruiterId: raj.id, specialtyId: marketing.id, weight: 'PRIMARY' },
    ],
  })
  const search = await prisma.intakeSearch.create({
    data: { firmId: firm.id, recruiterId: jane.id, title: 'CFO, healthcare services', functions: ['Finance'], levels: ['C-Suite'], mustHaves: ['IPO'], location: 'Boston' },
  })

  const storagePaths: string[] = []
  const emails = ['dana.whitfield.ncverify@example.com', 'leo.park.ncverify@example.com', 'priya.raman.ncverify@example.com']
  const settingsBefore = await prisma.recruiterSettings.findUnique({ where: { id: 'singleton' } })

  try {
    // 1. CFO through the FIRM page: routed to Jane, Fit for her search.
    const cfo = await ingestIntake({
      firm, recruiter: null, source: 'PAGE', entryPoint: 'FIRM_PAGE',
      person: { fullName: 'Dana Whitfield', email: emails[0] },
      file: { buffer: makePdf(CFO), fileName: 'Dana_Whitfield.pdf', contentType: 'application/pdf' },
      consentScopes: ['status', 'landing_details', 'bogus_scope'],
    })
    check('CFO ingested', cfo.ok, cfo.ok ? undefined : cfo.message)
    if (!cfo.ok) throw new Error('stop')
    check('CFO parse/tag ran', (await processIntakeResume(cfo.resumeId)) === 'done')
    const cfoConn = await prisma.intakeConnection.findUniqueOrThrow({ where: { id: cfo.connectionId }, include: { replies: true } })
    check('CFO auto-routed to Jane', cfoConn.recruiterId === jane.id, cfoConn.recruiterId ?? 'none')
    check('CFO tagged Fit for the search', cfoConn.tag === 'FIT' && cfoConn.searchId === search.id, `${cfoConn.tag}: ${cfoConn.tagReasons.join(' | ')}`)
    check('Fit gets no reply draft', cfoConn.replies.length === 0)
    check('Only known consent scopes stored', JSON.stringify(cfoConn.consentScopes) === JSON.stringify(['status', 'landing_details']))
    check('3-line summary saved', (cfoConn.summary ?? '').split('\n').length === 3, cfoConn.summary ?? '')
    const events = await prisma.intakeConsentEvent.count({ where: { connectionId: cfo.connectionId, granted: true } })
    check('Consent ledger has one row per granted scope', events === 2)

    // 2. Marketer through Jane's PERSONAL page: stays with Jane, Outside.
    const mkt = await ingestIntake({
      firm, recruiter: jane, source: 'PAGE', entryPoint: 'PERSONAL_PAGE',
      person: { fullName: 'Leo Park', email: emails[1] },
      file: { buffer: makePdf(MARKETER), fileName: 'leo.pdf', contentType: 'application/pdf' },
      consentScopes: [],
    })
    if (!mkt.ok) throw new Error(mkt.message)
    await processIntakeResume(mkt.resumeId)
    const mktConn = await prisma.intakeConnection.findUniqueOrThrow({ where: { id: mkt.connectionId }, include: { replies: true } })
    check('Personal page is not re-routed', mktConn.recruiterId === jane.id)
    check('Marketer below floor/outside Jane\'s focus is Outside', mktConn.tag === 'OUTSIDE', `${mktConn.tag}: ${mktConn.tagReasons.join(' | ')}`)
    check('Outside reply drafted, not sent', mktConn.replies.length === 1 && mktConn.replies[0].status === 'DRAFT' && mktConn.replies[0].kind === 'OUTSIDE')

    // 3. Finance manager by FORWARD to the firm address, email found in the
    // resume text: below the Director floor but partly matches Jane's
    // search (Finance) -> held as Niche, never Outside.
    const fwd = await ingestIntake({
      firm, recruiter: null, source: 'FORWARD', entryPoint: 'FIRM_ADDRESS',
      person: {},
      file: { buffer: makePdf(FINANCE_MANAGER), fileName: 'Priya Raman Resume.pdf', contentType: 'application/pdf' },
      consentScopes: [],
      excludeEmails: [jane.workEmail],
    })
    check('Forward found the candidate email in the resume text', fwd.ok, fwd.ok ? undefined : fwd.message)
    if (!fwd.ok) throw new Error('stop')
    await processIntakeResume(fwd.resumeId)
    const fwdConn = await prisma.intakeConnection.findUniqueOrThrow({ where: { id: fwd.connectionId }, include: { replies: true, intakeCandidate: true } })
    check('Partial search match is never tagged Outside', fwdConn.tag !== 'OUTSIDE' && fwdConn.partialSearchMatch, `${fwdConn.tag}: ${fwdConn.tagReasons.join(' | ')}`)
    check('Forward picked up the parsed name', fwdConn.intakeCandidate.fullName === 'Priya Raman', fwdConn.intakeCandidate.fullName)
    check('Forward sends no immediate email (claim invites 0)', fwdConn.intakeCandidate.claimInvitesSent === 0)

    // 4. Visibility rules.
    const ctx = (r: typeof jane, role: 'ADMIN' | 'RECRUITER' | 'COORDINATOR', seesAll = true) =>
      ({ recruiter: r, firm: { ...firm, intakeAdminSeesAll: seesAll }, role }) as Parameters<typeof visibleConnectionsWhere>[0]
    const rajSees = await prisma.intakeConnection.count({ where: visibleConnectionsWhere(ctx(raj, 'RECRUITER')) })
    const janeSees = await prisma.intakeConnection.count({ where: visibleConnectionsWhere(ctx(jane, 'ADMIN')) })
    const coordSees = await prisma.intakeConnection.findMany({ where: visibleConnectionsWhere(ctx(coordinator, 'COORDINATOR')), select: { recruiterId: true } })
    check('Recruiter with nothing assigned sees nothing', rajSees === 0, String(rajSees))
    check('Admin sees every firm candidate', janeSees === 3, String(janeSees))
    check('Coordinator sees only the general hopper', coordSees.every((c) => c.recruiterId === null), JSON.stringify(coordSees))

    // 5. Cap: with the cap at its current usage, the next parse queues.
    await prisma.recruiterFirm.update({ where: { id: firm.id }, data: { intakeDailyParseCap: 3 } })
    const again = await ingestIntake({
      firm: { ...firm, intakeDailyParseCap: 3 }, recruiter: jane, source: 'PAGE', entryPoint: 'PERSONAL_PAGE',
      person: { fullName: 'Leo Park', email: emails[1] },
      file: { buffer: makePdf(MARKETER), fileName: 'leo-v2.pdf', contentType: 'application/pdf' },
      consentScopes: ['status'],
    })
    if (!again.ok) throw new Error(again.message)
    check('Same email dedups to one person', again.intakeCandidateId === mkt.intakeCandidateId)
    check('Over the daily cap the parse queues', (await processIntakeResume(again.resumeId)) === 'queued')

    // 6. Sending switch: approve with sending off -> nothing sent.
    await prisma.recruiterSettings.update({ where: { id: 'singleton' }, data: { intakeAutoRepliesEnabled: false } })
    const draft = mktConn.replies[0]
    await prisma.intakeReply.update({ where: { id: draft.id }, data: { status: 'APPROVED', approvedById: jane.id, approvedAt: new Date() } })
    check('Approved reply is held while sending is off', (await sendApprovedReply(draft.id)) === 'disabled')
    const stillApproved = await prisma.intakeReply.findUniqueOrThrow({ where: { id: draft.id } })
    check('Held reply stays APPROVED, unsent', stillApproved.status === 'APPROVED' && !stillApproved.sentAt)

    const resumes = await prisma.intakeResume.findMany({ where: { firmId: firm.id }, select: { filePath: true } })
    storagePaths.push(...resumes.map((r) => r.filePath))
  } finally {
    if (settingsBefore) {
      await prisma.recruiterSettings.update({ where: { id: 'singleton' }, data: { intakeAutoRepliesEnabled: settingsBefore.intakeAutoRepliesEnabled } })
    }
    const leftover = await prisma.intakeResume.findMany({ where: { firmId: firm.id }, select: { filePath: true } })
    const paths = Array.from(new Set([...storagePaths, ...leftover.map((r) => r.filePath)]))
    if (paths.length > 0) await createAdminClient().storage.from('resumes').remove(paths)
    await prisma.intakeCandidate.deleteMany({ where: { email: { in: emails } } })
    await prisma.intakeParseUsage.deleteMany({ where: { firmId: firm.id } })
    await prisma.recruiter.deleteMany({ where: { id: { in: [jane.id, raj.id, coordinator.id] } } })
    await prisma.recruiterFirm.delete({ where: { id: firm.id } })
    // Talent isn't live yet, so every talent_* event mirrored since this
    // run started came from it.
    await prisma.analyticsEvent.deleteMany({ where: { event: { startsWith: 'talent_' }, createdAt: { gte: startedAt } } })
    console.log('Cleaned up test firm, recruiters, candidates and files.')
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  await prisma.$disconnect()
  process.exit(failed.length ? 1 : 0)
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
