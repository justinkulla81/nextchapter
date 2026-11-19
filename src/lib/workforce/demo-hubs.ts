import 'server-only'
// Sample data for the Education Hub and the Workforce Hub on a workforce demo: a training catalog (universities, third-party, offered by
// the region), the sister organizations and funders around the table, and the partners and match on each funding application. Idempotent:
// it clears what it made (createdBy 'demo') and makes it again, so it can run on a new demo or an existing one. Names are generic on
// purpose: nothing here names a real institution as offering a course.

import { prisma } from '@/lib/prisma'

const PROC = 'Process improvement (Lean, Six Sigma)'
const OFFERINGS = [
  { source: 'UNIVERSITY', title: 'Certificate in Supply Chain Analytics', provider: 'A partner university', summary: 'Forecasting, inventory and logistics analytics for working professionals. Evenings and online.', skills: ['Supply chain and logistics', 'Excel'], industries: ['Transportation & Logistics', 'Manufacturing & Industrial'], functions: ['Operations'], levels: ['Individual contributor', 'Manager'], hours: 120, priceCents: 320000, wioaEligible: true, assignment: 'LISTED' },
  { source: 'UNIVERSITY', title: 'Executive program: Leading through AI change', provider: 'A partner university', summary: 'How senior leaders plan, staff and govern work when AI changes the jobs.', skills: ['People management', 'AI or generative AI'], industries: [], functions: ['Executive Leadership', 'Operations'], levels: ['Director or above'], hours: 40, priceCents: 280000, wioaEligible: false, assignment: 'LISTED' },
  { source: 'UNIVERSITY', title: 'Data and Analytics Certificate', provider: 'A partner college', summary: 'Spreadsheets to dashboards: the data skills finance and operations teams ask for.', skills: ['Excel', 'Financial modeling or forecasting'], industries: [], functions: ['Finance', 'Data & Analytics'], levels: [], hours: 90, priceCents: 240000, wioaEligible: true, assignment: 'LISTED' },
  { source: 'THIRD_PARTY', title: 'Project Management Fundamentals', provider: 'An online provider', summary: 'Self-paced. Scope, schedule, risk and stakeholders.', skills: ['Project management'], industries: [], functions: [], levels: ['Individual contributor', 'Manager'], hours: 30, priceCents: 4900, wioaEligible: false, assignment: 'LISTED' },
  { source: 'THIRD_PARTY', title: 'Sales and Negotiation for Professionals', provider: 'An online provider', summary: 'Win agreement without a hard sell: preparation, framing and closing.', skills: ['Sales and negotiation'], industries: [], functions: ['Sales', 'Operations'], levels: [], hours: 12, priceCents: 19900, wioaEligible: false, assignment: 'ASSIGNED' },
  { source: 'THIRD_PARTY', title: 'People Management Essentials', provider: 'An online provider', summary: 'Feedback, delegation and difficult conversations for new and experienced managers.', skills: ['People management'], industries: [], functions: [], levels: ['Manager'], hours: 16, priceCents: 14900, wioaEligible: false, assignment: 'ASSIGNED' },
  { source: 'THIRD_PARTY', title: 'Compliance and Risk Basics', provider: 'A professional body', summary: 'The vocabulary and controls regulated employers expect.', skills: ['Compliance and risk'], industries: ['Financial Services & Banking', 'Insurance'], functions: [], levels: [], hours: 10, priceCents: 0, wioaEligible: false, assignment: 'LISTED' },
  { source: 'LOCAL', title: 'AI for professionals in our region', provider: 'NextChapter', summary: 'Built for this region: the AI skills local employers ask for, taught with local examples.', skills: ['AI or generative AI', PROC], industries: [], functions: [], levels: [], hours: 6, priceCents: 0, wioaEligible: false, assignment: 'ASSIGNED', ncCustom: true },
  { source: 'LOCAL', title: 'Career transition workshop series', provider: 'Offered by the region', summary: 'Four free sessions with the job center: résumé, interviews, benefits and your first 30 days.', skills: [], industries: [], functions: [], levels: [], hours: 8, priceCents: 0, wioaEligible: false, assignment: 'ASSIGNED' },
  { source: 'LOCAL', title: 'Lean Six Sigma for operations leaders', provider: 'Offered by the region', summary: 'A cohort for operations managers, paid for by the workforce board where eligible.', skills: [PROC], industries: ['Manufacturing & Industrial', 'Transportation & Logistics'], functions: ['Operations'], levels: ['Manager'], hours: 60, priceCents: 0, wioaEligible: true, assignment: 'ASSIGNED' },
] as const

const PARTNERS = [
  { name: 'Regional economic development partner', kind: 'ECON_DEV', status: 'CONFIRMED', commitments: ['MATCH', 'OPENINGS'] },
  { name: 'Regional workforce board', kind: 'WORKFORCE_BOARD', status: 'CONFIRMED', commitments: ['SEATS'] },
  { name: 'American Job Center', kind: 'JOB_CENTER', status: 'CONFIRMED', commitments: ['SEATS', 'SPACE'] },
  { name: 'Metro chamber of commerce', kind: 'CHAMBER', status: 'CONFIRMED', commitments: ['MATCH', 'HIRING'] },
  { name: 'Community nonprofit', kind: 'NONPROFIT', status: 'INVITED', commitments: [] as string[] },
  { name: 'Neighboring county nonprofit', kind: 'NONPROFIT', status: 'UNINVITED', commitments: [] as string[] },
  { name: 'Community foundation', kind: 'FUNDER', status: 'CONFIRMED', commitments: ['MATCH'] },
] as const

const COHORTS = [
  { name: 'Operations managers', purpose: 'People we can place in logistics and manufacturing roles this quarter.', industries: [], functions: ['Operations'], levels: ['Manager'], minWeeksOut: null, post: 'A hiring event for operations managers is Dec 9 at the job center. Bring a résumé.' },
  { name: 'Out of work 26 weeks or more', purpose: 'People who need the most support, soonest.', industries: [], functions: [], levels: [], minWeeksOut: 26, post: 'Free coaching sessions are open this month. Reply to your career seat email to book one.' },
] as const

const GROUPS = [
  { name: 'Workforce coordination council', purpose: 'Meets monthly to line up funding, referrals and what we say to employers.', members: ['Regional economic development partner', 'Regional workforce board', 'American Job Center', 'Metro chamber of commerce', 'Community nonprofit'], posts: ['Next meeting Dec 9. The Reserve Fund application is due Dec 2: please confirm your match by Friday.', 'Thank you all for the layoff response last month. Three more notices came in this week; the job center will lead outreach.'] },
  { name: 'Funders table', purpose: 'Foundations and chambers that bring match to our applications.', members: ['Community foundation', 'Metro chamber of commerce'], posts: ['Draft budget for the Talent Recruitment Grant is in the shared folder.'] },
] as const

// Partners on each funding application, by the application's order in the demo (see seedWorkforceDemo).
const COMMITMENTS: { app: number; partnerName: string; partnerKind: string; role: string; status: string; amount: number | null; note: string | null }[] = [
  { app: 0, partnerName: 'Regional workforce board', partnerKind: 'WORKFORCE_BOARD', role: 'LEAD', status: 'COMMITTED', amount: null, note: 'Applicant of record' },
  { app: 0, partnerName: 'Metro chamber of commerce', partnerKind: 'CHAMBER', role: 'MATCH', status: 'COMMITTED', amount: 20000, note: 'Board approved' },
  { app: 0, partnerName: 'Community foundation', partnerKind: 'FUNDER', role: 'MATCH', status: 'COMMITTED', amount: 10000, note: null },
  { app: 0, partnerName: 'A partner college', partnerKind: 'COLLEGE', role: 'PARTNER', status: 'ASKED', amount: null, note: 'Cohort seats each term' },
  { app: 0, partnerName: 'A member employer', partnerKind: 'EMPLOYER', role: 'MATCH', status: 'ASKED', amount: 15000, note: 'In-kind: trainer time and a classroom' },
  { app: 1, partnerName: 'Regional economic development partner', partnerKind: 'ECON_DEV', role: 'LEAD', status: 'ASKED', amount: null, note: null },
  { app: 1, partnerName: 'Metro chamber of commerce', partnerKind: 'CHAMBER', role: 'MATCH', status: 'ASKED', amount: 40000, note: 'Pending board vote' },
  { app: 1, partnerName: 'Neighboring county nonprofit', partnerKind: 'NONPROFIT', role: 'PARTNER', status: 'ASKED', amount: null, note: null },
  { app: 2, partnerName: 'State workforce agency', partnerKind: 'OTHER', role: 'LEAD', status: 'COMMITTED', amount: null, note: null },
  { app: 2, partnerName: 'American Job Center', partnerKind: 'JOB_CENTER', role: 'EVIDENCE', status: 'COMMITTED', amount: null, note: 'Letter of support' },
]

/** Fills an existing or new workforce demo's Education Hub and Workforce Hub. `appIds` are its funding applications, oldest first. */
export async function seedHubSamples(institutionId: string, appIds: string[]) {
  await prisma.fundingPartnerCommitment.deleteMany({ where: { institutionId, createdBy: 'demo' } })
  await prisma.trainingOffering.deleteMany({ where: { institutionId, createdBy: 'demo' } })
  await prisma.trainingOffering.createMany({
    data: OFFERINGS.map((o) => ({ institutionId, source: o.source, title: o.title, provider: o.provider, summary: o.summary, skills: [...o.skills], industries: [...o.industries], functions: [...o.functions], levels: [...o.levels], hours: o.hours, priceCents: o.priceCents, wioaEligible: o.wioaEligible, ncCustom: 'ncCustom' in o && o.ncCustom === true, assignment: o.assignment, createdBy: 'demo' })),
  })
  const have = new Set((await prisma.ecosystemPartner.findMany({ where: { institutionId }, take: 300, select: { name: true } })).map((p) => p.name))
  const now = Date.now()
  const fresh = PARTNERS.filter((p) => !have.has(p.name))
  if (fresh.length) {
    await prisma.ecosystemPartner.createMany({
      data: fresh.map((p) => ({ institutionId, name: p.name, kind: p.kind, source: 'MANUAL', status: p.status, commitments: [...p.commitments], invitedAt: p.status === 'UNINVITED' ? null : new Date(now - 10 * 86_400_000), decidedAt: p.status === 'CONFIRMED' ? new Date(now - 5 * 86_400_000) : null, createdBy: 'demo', isSampleData: true })),
    })
  }
  // Three referrals to partners (about needs, not people), in each state, so Referrals has something to read.
  await prisma.partnerReferral.deleteMany({ where: { institutionId, createdBy: 'demo' } })
  const pid = new Map((await prisma.ecosystemPartner.findMany({ where: { institutionId }, take: 300, select: { id: true, name: true } })).map((p) => [p.name, p.id]))
  const day = 86_400_000
  const refs = [
    { partner: 'American Job Center', title: 'Host a hiring event for operations managers', cohortName: 'Operations managers', offeringTitle: null, people: 40, due: 21, status: 'ACCEPTED', answerNote: 'We can host it Dec 9 at the center, 10 to 2.', answeredDays: 2, agoDays: 6 },
    { partner: 'Regional workforce board', title: 'Fund seats in the Lean Six Sigma cohort for people out 26 weeks or more', cohortName: 'Out of work 26 weeks or more', offeringTitle: 'Lean Six Sigma for operations leaders', people: 20, due: 30, status: 'SENT', answerNote: null, answeredDays: 0, agoDays: 1 },
    { partner: 'Community nonprofit', title: 'Career coaching for long-term unemployed professionals', cohortName: null, offeringTitle: null, people: null, due: null, status: 'DECLINED', answerNote: 'Our coaches are booked until spring. We can take a referral in March.', answeredDays: 4, agoDays: 8 },
  ]
  for (const r of refs) {
    const partnerId = pid.get(r.partner)
    if (!partnerId) continue
    await prisma.partnerReferral.create({ data: { institutionId, partnerId, title: r.title, cohortName: r.cohortName, offeringTitle: r.offeringTitle, people: r.people, dueDate: r.due ? new Date(now + r.due * day) : null, status: r.status, answerNote: r.answerNote, answeredAt: r.answeredDays ? new Date(now - r.answeredDays * day) : null, createdBy: 'demo', createdAt: new Date(now - r.agoDays * day) } })
  }
  // Two talent cohorts (rules, not lists) with an update each, so the Cohorts tab has something to read.
  await prisma.talentCohort.deleteMany({ where: { institutionId, createdBy: 'demo' } })
  for (const c of COHORTS) {
    await prisma.talentCohort.create({
      data: { institutionId, name: c.name, purpose: c.purpose, industries: [...c.industries], functions: [...c.functions], levels: [...c.levels], minWeeksOut: c.minWeeksOut, createdBy: 'demo', posts: { create: [{ body: c.post, authorLabel: 'Your organization', createdBy: 'demo', createdAt: new Date(now - 2 * 86_400_000) }] } },
    })
  }
  // Two groups of partners with updates, so the Groups tab (and a partner's Groups tab) has something to read.
  await prisma.partnerGroup.deleteMany({ where: { institutionId, createdBy: 'demo' } })
  const byName = new Map((await prisma.ecosystemPartner.findMany({ where: { institutionId }, take: 300, select: { id: true, name: true } })).map((p) => [p.name, p.id]))
  for (const g of GROUPS) {
    const memberIds = g.members.flatMap((n) => (byName.get(n) ? [byName.get(n) as string] : []))
    await prisma.partnerGroup.create({
      data: {
        institutionId, name: g.name, purpose: g.purpose, createdBy: 'demo',
        members: { create: memberIds.map((partnerId) => ({ partnerId })) },
        posts: { create: g.posts.map((body, i) => ({ body, createdBy: 'demo', authorLabel: 'Your organization', createdAt: new Date(now - (i + 1) * 3 * 86_400_000) })) },
      },
    })
  }
  const rows = COMMITMENTS.flatMap((c) => (appIds[c.app] ? [{ institutionId, applicationId: appIds[c.app], partnerName: c.partnerName, partnerKind: c.partnerKind, role: c.role, status: c.status, amount: c.amount, note: c.note, createdBy: 'demo' }] : []))
  if (rows.length) await prisma.fundingPartnerCommitment.createMany({ data: rows })
}
