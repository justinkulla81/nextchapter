// Reusable, re-runnable fixture: connects the existing test Coach,
// Recruiter, and Hiring Manager (EmployerProfile) accounts to the 20
// @nextchapter.test candidates from seed-test-candidates.ts — coaching
// relationships + sessions, a recruiter's sourced-candidate book, and
// hiring-manager roles + a candidate pipeline — plus profile pictures for
// most candidates, the coach, and the recruiter (pravatar.cc placeholder
// photos; real image URLs work fine in profilePictureUrl, no Storage
// upload required for fixture data).
//
// Does NOT create or touch auth credentials for the coach/recruiter/
// employer accounts — those are real accounts you already set up
// (identified below by their known work email / company name). This only
// adds/updates data rows connected to them.
//
// Run: npm run seed:portal-connections
// Re-run anytime — the "connection" rows this script owns (CoachSession,
// SourcedCandidate, CalibrationMemo, RoleProfile, CandidateInteraction,
// ApprovedEmployer scoped to these three accounts) are deleted and
// recreated each run; direct field updates (coachId, profilePictureUrl,
// etc.) are plain idempotent writes.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COACH_EMAIL = 'justin.kulla+coach@gmail.com'
const RECRUITER_EMAIL = 'justin.kulla+recruiter@gmail.com'
const EMPLOYER_COMPANY = 'NC Test Co (Hiring Manager)'

function pravatar(n: number) {
  return `https://i.pravatar.cc/300?img=${n}`
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

async function main() {
  const coach = await prisma.coach.findUnique({ where: { workEmail: COACH_EMAIL } })
  const recruiter = await prisma.recruiter.findUnique({ where: { workEmail: RECRUITER_EMAIL } })
  const employer = await prisma.employerProfile.findFirst({ where: { companyName: EMPLOYER_COMPANY } })

  if (!coach) throw new Error(`No coach found with workEmail ${COACH_EMAIL} — set it up first.`)
  if (!recruiter) throw new Error(`No recruiter found with workEmail ${RECRUITER_EMAIL} — set it up first.`)
  if (!employer) throw new Error(`No employer found with companyName "${EMPLOYER_COMPANY}" — set it up first.`)

  const candidates = await prisma.candidateProfile.findMany({
    where: { email: { endsWith: '@nextchapter.test' } },
    orderBy: { email: 'asc' },
  })
  if (candidates.length < 20) {
    throw new Error(`Expected 20 @nextchapter.test candidates, found ${candidates.length} — run seed:test-candidates first.`)
  }
  const byNum = (n: number) => candidates[n - 1]

  // ── Profile pictures — coach, recruiter, and 15 of 20 candidates ──────────
  await prisma.coach.update({ where: { id: coach.id }, data: { profilePictureUrl: pravatar(68) } })
  await prisma.recruiter.update({ where: { id: recruiter.id }, data: { profilePictureUrl: pravatar(33) } })
  for (let n = 1; n <= 15; n++) {
    await prisma.candidateProfile.update({
      where: { id: byNum(n).id },
      data: { profilePictureUrl: pravatar(n) },
    })
  }
  console.log('Set profile pictures: coach, recruiter, and candidates 01-15')

  // ── Coach: assign 5 clients, sessions, one onboarding response ────────────
  const coachClients = [byNum(2), byNum(4), byNum(7), byNum(9), byNum(13)]
  await prisma.coachSession.deleteMany({ where: { coachId: coach.id, candidateId: { in: coachClients.map((c) => c.id) } } })
  await prisma.coachingOnboardingResponse.deleteMany({ where: { coachId: coach.id, candidateId: { in: coachClients.map((c) => c.id) } } })

  for (const client of coachClients) {
    await prisma.candidateProfile.update({
      where: { id: client.id },
      data: { coachId: coach.id, coachDossierConsentedAt: new Date() },
    })
  }

  const sessionContent: Record<string, { notes: string; directives: string; focusNote: string }> = {
    [byNum(2).id]: {
      notes: 'Marcus is strong technically but under-selling scope in interviews — keeps describing IC work, not the team he led.',
      directives: 'Rewrite the "tell me about yourself" answer to lead with team size and business impact, not tech stack.',
      focusNote: 'Practice the leadership framing out loud before the next panel round.',
    },
    [byNum(4).id]: {
      notes: 'Sofia is close on two board-level roles. Confidence is the gap, not competence — she second-guesses comp asks.',
      directives: 'Draft a comp range with a number she can say without flinching, and rehearse the negotiation call.',
      focusNote: 'Bring the term sheet from the CFO-track offer next session.',
    },
    [byNum(7).id]: {
      notes: "Emma's search has been quiet — mostly cold applications, low response rate.",
      directives: 'Shift this week toward warm outreach: 5 messages to people in her actual network, not job boards.',
      focusNote: 'Check whether the outreach shift moved her response rate at all.',
    },
    [byNum(9).id]: {
      notes: 'Renee landed two first-round interviews this week. Good momentum — keep pace, watch for burnout.',
      directives: 'Prep the CS-VP-specific story bank (churn save, team scaling) before Thursday.',
      focusNote: 'Ask how she is holding up — this is week 6 and pace has been intense.',
    },
    [byNum(13).id]: {
      notes: 'Omar is pivoting from B2C to B2B product — narrative still reads B2C-first.',
      directives: 'Rewrite the core narrative to lead with the B2B-transferable pieces (enterprise stakeholder mgmt, longer sales cycles).',
      focusNote: 'Review the rewritten narrative together before he sends anything else out.',
    },
  }

  for (const client of coachClients) {
    const content = sessionContent[client.id]!
    await prisma.coachSession.create({
      data: {
        candidateId: client.id,
        coachId: coach.id,
        occurredAt: daysAgo(14),
        durationMinutes: 30,
        notes: `First session. ${content.notes}`,
        directives: content.directives,
      },
    })
    await prisma.coachSession.create({
      data: {
        candidateId: client.id,
        coachId: coach.id,
        occurredAt: daysAgo(2),
        durationMinutes: 30,
        notes: content.notes,
        directives: content.directives,
        focusNote: content.focusNote,
      },
    })
  }

  await prisma.coachingOnboardingResponse.create({
    data: {
      candidateId: byNum(9).id,
      coachId: coach.id,
      answers: {
        primaryGoal: 'Land a VP of Customer Success role at a Series C+ company within 90 days.',
        workingStylePreference: 'direct',
        biggestBlocker: 'Confidence in negotiating comp after 8 months out.',
        checkInCadence: 'weekly',
      },
    },
  })
  console.log(`Coach: assigned ${coachClients.length} clients, ${coachClients.length * 2} sessions, 1 onboarding response`)

  // ── Recruiter: sourced-candidate book + calibration memos ─────────────────
  await prisma.sourcedCandidate.deleteMany({ where: { recruiterId: recruiter.id } })
  await prisma.calibrationMemo.deleteMany({ where: { recruiterId: recruiter.id } })

  const signedUp = [byNum(11), byNum(15), byNum(20)]
  for (const c of signedUp) {
    await prisma.candidateProfile.update({ where: { id: c.id }, data: { sourcingRecruiterId: recruiter.id } })
  }
  await prisma.sourcedCandidate.create({
    data: {
      recruiterId: recruiter.id,
      name: `${byNum(11).firstName} ${byNum(11).lastName}`,
      email: byNum(11).email!,
      notes: 'Met at a networking event, strong backend background.',
      status: 'SIGNED_UP',
      candidateId: byNum(11).id,
      resumeCommentary: 'Clean, quantified bullets — leads with system-scale numbers. Ready to submit as-is.',
      inBook: true,
    },
  })
  await prisma.sourcedCandidate.create({
    data: {
      recruiterId: recruiter.id,
      name: `${byNum(15).firstName} ${byNum(15).lastName}`,
      email: byNum(15).email!,
      notes: 'Referred by a former placement.',
      status: 'SIGNED_UP',
      candidateId: byNum(15).id,
      resumeCommentary: 'Strong FP&A background, resume undersells the M&A diligence work — flagged for a rewrite.',
      inBook: true,
    },
  })
  await prisma.sourcedCandidate.create({
    data: {
      recruiterId: recruiter.id,
      name: `${byNum(20).firstName} ${byNum(20).lastName}`,
      email: byNum(20).email!,
      notes: 'Applied to a role I closed 2 years ago, kept in touch.',
      status: 'SIGNED_UP',
      candidateId: byNum(20).id,
    },
  })
  // Two leads from the recruiter's own network who aren't on the platform yet.
  await prisma.sourcedCandidate.create({
    data: {
      recruiterId: recruiter.id,
      name: 'Diane Whitfield',
      email: 'diane.whitfield.lead@example.com',
      notes: 'VP Ops at a mid-market logistics company, quietly looking. Not yet invited.',
      status: 'ADDED',
    },
  })
  await prisma.sourcedCandidate.create({
    data: {
      recruiterId: recruiter.id,
      name: 'Marcus Feldman',
      email: 'marcus.feldman.lead@example.com',
      notes: 'Former colleague, Director of Eng, laid off last month. Sent an invite.',
      status: 'INVITED',
      inviteToken: 'seed-invite-marcus-feldman',
      invitedAt: daysAgo(3),
    },
  })

  await prisma.calibrationMemo.create({
    data: {
      recruiterId: recruiter.id,
      briefText: 'Searching for a Director of Engineering, Series B fintech, remote-first, $190-220k base.',
      memoText:
        'Target profile: 8-12 years experience, at least 3 in a people-management role, fintech or regulated-industry background preferred but not required. Watch for candidates who read as "IC with a title" — the role needs someone who has actually run a hiring loop and owned a roadmap, not just shipped code. Comp band is competitive but not top-of-market, so candidates motivated primarily by cash comp will likely fall out in negotiation — screen for mission/stage fit early.',
    },
  })
  await prisma.calibrationMemo.create({
    data: {
      recruiterId: recruiter.id,
      briefText: 'Searching for a VP Finance, Series C, on-site NYC 3 days/week.',
      memoText:
        'Target profile: public-company-adjacent (either public company experience or a company that ran an active IPO process), strong board-reporting background. The hiring manager cares more about polish in board settings than raw technical depth — a great VP Finance who has never presented to a board is a real risk for this specific seat.',
    },
  })
  console.log(`Recruiter: 3 signed-up sourced candidates (in book), 2 external leads, 2 calibration memos`)

  // ── Hiring Manager: roles + candidate pipeline ─────────────────────────────
  await prisma.candidateInteraction.deleteMany({ where: { employerId: employer.id } })
  await prisma.approvedEmployer.deleteMany({ where: { employerId: employer.id } })
  await prisma.roleProfile.deleteMany({ where: { employerId: employer.id } })

  const roleOps = await prisma.roleProfile.create({
    data: {
      employerId: employer.id,
      roleTitle: 'VP of Operations',
      roleLevel: 'VP',
      primaryFunction: 'Operations',
      locationRequirement: 'Remote (US)',
      remotePolicy: 'remote',
      compMin: 180000,
      compMax: 220000,
      equityOffered: true,
      requiredPaceLevel: 4,
      requiredFeedbackStyle: 3,
      requiredCollabStyle: 3,
      requiredStructure: 2,
      requiredAmbiguity: 4,
      requiredHours: 3,
      success30Days: 'Fully ramped on current operating cadence and key vendor relationships.',
      success90Days: 'Owns the Q3 ops roadmap and has identified the first process to fix.',
      success180Days: 'Measurable improvement in fulfillment SLAs, team structure finalized.',
      hmWorkStyle: 4,
      hmFeedbackStyle: 3,
      hmManagementApproach: 'Hands-off once trust is established, weekly 1:1s otherwise.',
      hmWhatGoodLooksLike: 'Someone who brings me problems with a recommended fix, not just a problem.',
      offersMoreThan: ['autonomy', 'mission'],
      offersLessThan: ['base_comp', 'brand_recognition'],
    },
  })
  const roleFinance = await prisma.roleProfile.create({
    data: {
      employerId: employer.id,
      roleTitle: 'Director of Finance',
      roleLevel: 'Director',
      primaryFunction: 'Finance',
      locationRequirement: 'Boston, MA',
      remotePolicy: 'hybrid',
      compMin: 160000,
      compMax: 190000,
      equityOffered: true,
      requiredPaceLevel: 3,
      requiredFeedbackStyle: 4,
      requiredCollabStyle: 4,
      requiredStructure: 4,
      requiredAmbiguity: 2,
      requiredHours: 3,
      success30Days: 'Understands the current close process end to end.',
      success90Days: 'Owns the monthly board reporting package independently.',
      success180Days: 'Has proposed and started one process improvement to close timeline.',
      hmWorkStyle: 3,
      hmFeedbackStyle: 4,
      hmManagementApproach: 'Structured, regular check-ins, clear written expectations.',
      hmWhatGoodLooksLike: 'Precision and no surprises in the numbers.',
      offersMoreThan: ['stability', 'learning'],
      offersLessThan: ['base_comp'],
    },
  })
  const roleMarketing = await prisma.roleProfile.create({
    data: {
      employerId: employer.id,
      roleTitle: 'Head of Marketing',
      roleLevel: 'Director',
      primaryFunction: 'Marketing',
      locationRequirement: 'Remote (US)',
      remotePolicy: 'remote',
      compMin: 170000,
      compMax: 200000,
      equityOffered: true,
      requiredPaceLevel: 5,
      requiredFeedbackStyle: 3,
      requiredCollabStyle: 4,
      requiredStructure: 2,
      requiredAmbiguity: 5,
      requiredHours: 4,
      success30Days: 'Has audited the current funnel and identified the top 3 leverage points.',
      success90Days: 'First new campaign live with measurable pipeline impact.',
      success180Days: 'Team is hired out and marketing is a predictable pipeline contributor.',
      hmWorkStyle: 5,
      hmFeedbackStyle: 3,
      hmManagementApproach: 'Fast-moving, comfortable with ambiguity, expects the same in return.',
      hmWhatGoodLooksLike: 'Bias to ship and iterate over a perfect plan.',
      offersMoreThan: ['autonomy', 'equity_upside'],
      offersLessThan: ['process', 'job_security'],
    },
  })
  console.log('Hiring Manager: 3 roles posted (VP Operations, Director of Finance, Head of Marketing)')

  // Candidate pipeline across the three roles, varied funnel stages.
  const pipeline: {
    candidate: (typeof candidates)[number]
    roleId: string
    status: 'VIEWED' | 'SAVED' | 'INTEREST_EXPRESSED' | 'CANDIDATE_REVEALED' | 'IN_CONVERSATION' | 'HIRED' | 'PASSED'
    genericMatchScore: number
    workStyleAlignment: number
    situationRelevance: number
    frictionPoints?: string[]
    reveal?: boolean
    hired?: boolean
  }[] = [
    { candidate: byNum(8), roleId: roleOps.id, status: 'IN_CONVERSATION', genericMatchScore: 88, workStyleAlignment: 85, situationRelevance: 90, reveal: true },
    { candidate: byNum(17), roleId: roleOps.id, status: 'SAVED', genericMatchScore: 74, workStyleAlignment: 70, situationRelevance: 75, frictionPoints: ['Based outside the US, visa status unclear'] },
    { candidate: byNum(2), roleId: roleOps.id, status: 'VIEWED', genericMatchScore: 61, workStyleAlignment: 55, situationRelevance: 68 },
    { candidate: byNum(4), roleId: roleFinance.id, status: 'HIRED', genericMatchScore: 94, workStyleAlignment: 92, situationRelevance: 96, reveal: true, hired: true },
    { candidate: byNum(15), roleId: roleFinance.id, status: 'CANDIDATE_REVEALED', genericMatchScore: 82, workStyleAlignment: 80, situationRelevance: 84, reveal: true },
    { candidate: byNum(10), roleId: roleFinance.id, status: 'PASSED', genericMatchScore: 52, workStyleAlignment: 40, situationRelevance: 58, frictionPoints: ['Legal background, no finance leadership experience'] },
    { candidate: byNum(1), roleId: roleMarketing.id, status: 'INTEREST_EXPRESSED', genericMatchScore: 79, workStyleAlignment: 82, situationRelevance: 77 },
    { candidate: byNum(12), roleId: roleMarketing.id, status: 'VIEWED', genericMatchScore: 65, workStyleAlignment: 60, situationRelevance: 63 },
  ]

  for (const row of pipeline) {
    await prisma.candidateProfile.update({
      where: { id: row.candidate.id },
      data: { recruiterDatabaseOptIn: true, privacyTier: 'SEMI_PUBLIC' },
    })
    await prisma.candidateInteraction.create({
      data: {
        employerId: employer.id,
        candidateId: row.candidate.id,
        roleId: row.roleId,
        status: row.status,
        genericMatchScore: row.genericMatchScore,
        workStyleAlignment: row.workStyleAlignment,
        situationRelevance: row.situationRelevance,
        tailoredFitScore: row.genericMatchScore,
        frictionPoints: row.frictionPoints ?? [],
        hiredAt: row.hired ? daysAgo(10) : null,
        thirtyDayRating: row.hired ? 5 : null,
      },
    })
    if (row.reveal) {
      await prisma.approvedEmployer.create({
        data: { candidateId: row.candidate.id, employerId: employer.id },
      })
    }
  }
  console.log(`Hiring Manager: ${pipeline.length} candidate interactions across 3 roles, ${pipeline.filter((r) => r.reveal).length} identity reveals, 1 hire`)

  console.log('\nDone.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
