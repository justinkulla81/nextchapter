import 'server-only'
import { prisma } from '@/lib/prisma'
import { EXCLUDE_SYSTEM_ACCOUNT } from '@/lib/admin/system-account-filter'
import type { ApplicationFact, ContactFact, CoachSessionFact, MemberFacts, ReportInput } from './facts'
import type { MonthWindow } from './period'

// Reads every table the monthly report needs, once, and folds the rows into
// one MemberFacts per member. Event tables are limited to the report month
// plus the month before it, which is all the month-over-month view needs.

const DIMENSIONS = ['Targeting', 'Motivation', 'Networking', 'Application volume', 'Skills', 'Narrative', 'Interview practice'] as const

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function distinct(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v))]
}

function seniorityFromYears(years: number | null): string | null {
  if (years === null) return null
  if (years < 5) return 'EARLY'
  if (years < 12) return 'MID'
  if (years < 20) return 'SENIOR'
  return 'EXECUTIVE'
}

export async function loadReportInput(current: MonthWindow, prior: MonthWindow): Promise<ReportInput> {
  const since = prior.start
  const until = current.end
  const recent = { gte: since, lt: until }

  const [
    profiles, education, work, analyses, resumeCounts, references, scores, applications, outreach, linkedin,
    community, checkIns, logins, sprints, courses, sessions, contacts, contactTotals, hires, intros, submissions,
    placements, memberships, styles, snapshots, waitlist,
  ] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { ...EXCLUDE_SYSTEM_ACCOUNT, isSampleData: false, registrationCompletedAt: { not: null, lt: until }, deactivatedAt: null },
      select: {
        id: true, registrationCompletedAt: true, yearsExperience: true, highestEducationLevel: true, ageBand: true,
        currentState: true, currentCountry: true, metroArea: true, primaryFunction: true, industryBucket: true, industryContext: true,
        currentJobStatus: true, journey: true, leadSource: true, careerTrajectory: true, isPivoting: true,
        targetRoleType: true, targetFunction: true, targetIndustries: true, remotePreference: true, openToRelocation: true,
        willingToStartLower: true, interimConsultingInterest: true, targetCompanySize: true, targetCompanyStage: true,
        targetCompMin: true, applicationVolumeGoal: true, networkingOutreachTargetPerWeek: true, searchIntensity: true,
        jobSearchIntensity: true, changeReadiness: true, gapDuration: true, confidentialSearchMode: true, motivations: true,
        blockers: true, biggestBarriers: true, networkingConcerns: true, networkConnectPreferences: true, topStrengths: true,
        growthAreas: true, skillsToBuild: true, coachingStylePreference: true, changePacePreference: true,
        notificationTier: true, networkComfortLevel: true, publicDisclosureComfort: true, networkingLevel: true,
        storyComfort: true, interviewComfort: true, elevatorPitchReady: true, negotiationComfort: true, coachId: true,
        resumeStepComplete: true, assessmentComplete: true, contractAccepted: true, trackRecordCompletedAt: true,
        whatINeedCompletedAt: true, skillsAssessmentCompletedAt: true, searchStrategyConfirmedAt: true,
        recruiterDatabaseOptIn: true, resumeBookOptIn: true, leaderboardOptIn: true, currentStreak: true,
      },
    }),
    prisma.educationEntry.findMany({
      select: { candidateId: true, schoolName: true, fieldOfStudy: true, isPrimary: true, school: { select: { name: true } } },
    }),
    prisma.workHistoryEntry.findMany({
      select: { candidateId: true, companyName: true, isCurrent: true, endDate: true },
    }),
    prisma.resumeAnalysis.findMany({
      select: { candidateId: true, seniorityBand: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.resume.groupBy({ by: ['candidateId'], _count: { _all: true } }),
    prisma.reference.findMany({ select: { candidateId: true, requestedAt: true, completedAt: true } }),
    prisma.marketRealityComponentScore.findMany({
      select: { candidateId: true, grade: true, compositeScore: true, experienceScore: true, resumeScore: true, evidenceScore: true, effortScore: true, marketScore: true },
    }),
    prisma.jobPosting.findMany({
      where: { OR: [{ createdAt: recent }, { appliedAt: recent }, { interviewLandedAt: recent }, { offerReceivedAt: recent }, { declinedAt: recent }] },
      select: { candidateId: true, channel: true, companyName: true, createdAt: true, appliedAt: true, interviewLandedAt: true, offerReceivedAt: true, declinedAt: true },
    }),
    prisma.outreachLog.findMany({ where: { loggedAt: recent }, select: { candidateId: true, loggedAt: true, channel: true } }),
    prisma.linkedInActivityLog.findMany({ where: { loggedAt: recent }, select: { candidateId: true, loggedAt: true } }),
    prisma.communityPost.findMany({ where: { createdAt: recent }, select: { candidateId: true, createdAt: true } }),
    prisma.dailyCheckIn.findMany({ where: { checkedInAt: recent }, select: { candidateId: true, checkedInAt: true, mood: true } }),
    prisma.candidateLoginEvent.findMany({ where: { createdAt: recent }, select: { candidateId: true, createdAt: true } }),
    prisma.weeklySprint.findMany({ where: { weekStartDate: recent }, select: { candidateId: true, weekStartDate: true } }),
    prisma.candidateCourseActivity.findMany({ where: { detectedAt: recent }, select: { candidateId: true, detectedAt: true, status: true } }),
    prisma.coachSession.findMany({
      where: { occurredAt: recent },
      select: {
        candidateId: true, occurredAt: true, sessionType: true, durationMinutes: true, candidateRating: true,
        dimTargetingStatus: true, dimMotivationStatus: true, dimNetworkingStatus: true, dimApplicationVolumeStatus: true,
        dimSkillsStatus: true, dimNarrativeStatus: true, dimInterviewPracticeStatus: true,
      },
    }),
    prisma.supportNetworkContact.findMany({
      where: { createdAt: recent, removedAt: null },
      select: { candidateId: true, createdAt: true, warmth: true, source: true, category: true },
    }),
    prisma.supportNetworkContact.groupBy({ by: ['candidateId'], where: { removedAt: null }, _count: { _all: true } }),
    prisma.bountyClaim.findMany({ where: { status: 'APPROVED', startDate: recent }, select: { candidateId: true, startDate: true } }),
    prisma.recruiterCandidateIntroduction.findMany({ where: { createdAt: recent }, select: { candidateId: true, createdAt: true } }),
    prisma.recruiterCandidateSubmission.findMany({ where: { createdAt: recent }, select: { candidateId: true, createdAt: true } }),
    prisma.recruiterPlacement.findMany({ where: { placedAt: recent }, select: { candidateId: true, placedAt: true } }),
    prisma.membershipSubscription.findMany({ select: { candidateId: true, planKey: true, status: true } }),
    prisma.coachingStyleResponse.findMany({ select: { candidateId: true, topStyles: true } }),
    prisma.marketRealitySnapshot.findMany({
      where: { weekStartDate: { gte: current.start, lt: current.end } },
      select: { candidateId: true, grade: true, weekStartDate: true },
      orderBy: { weekStartDate: 'asc' },
    }),
    prisma.coachingWaitlist.findMany({ where: { createdAt: recent }, select: { createdAt: true } }),
  ])

  const by = <R extends { candidateId: string }>(rows: R[]) => {
    const map = new Map<string, R[]>()
    for (const r of rows) push(map, r.candidateId, r)
    return map
  }
  const eduBy = by(education)
  const workBy = by(work)
  const refBy = by(references)
  const appBy = by(applications)
  const outBy = by(outreach)
  const liBy = by(linkedin)
  const comBy = by(community)
  const ciBy = by(checkIns)
  const loginBy = by(logins)
  const spBy = by(sprints)
  const courseBy = by(courses)
  const sessBy = by(sessions)
  const contactBy = by(contacts)
  const hireBy = by(hires)
  const introBy = by(intros)
  const subBy = by(submissions)
  const plBy = by(placements)
  const snapBy = by(snapshots)

  const seniority = new Map<string, string>()
  for (const a of analyses) if (!seniority.has(a.candidateId)) seniority.set(a.candidateId, a.seniorityBand) // newest first
  const resumeCount = new Map(resumeCounts.map((r) => [r.candidateId, r._count._all]))
  const scoreBy = new Map(scores.map((s) => [s.candidateId, s]))
  const totalContacts = new Map(contactTotals.map((c) => [c.candidateId, c._count._all]))
  const membershipBy = new Map(memberships.map((m) => [m.candidateId, m]))
  const styleBy = new Map(styles.map((s) => [s.candidateId, s.topStyles]))

  const members: MemberFacts[] = profiles.map((p) => {
    const edu = eduBy.get(p.id) ?? []
    const jobs = workBy.get(p.id) ?? []
    const refs = refBy.get(p.id) ?? []
    const score = scoreBy.get(p.id)
    const snaps = snapBy.get(p.id) ?? []
    const mem = membershipBy.get(p.id)
    const currentJobs = jobs.filter((j) => j.isCurrent)

    const apps: ApplicationFact[] = (appBy.get(p.id) ?? []).map((a) => ({
      channel: a.channel, company: a.companyName?.trim() || null, createdAt: a.createdAt, appliedAt: a.appliedAt,
      interviewAt: a.interviewLandedAt, offerAt: a.offerReceivedAt, declinedAt: a.declinedAt,
    }))
    const sess: CoachSessionFact[] = (sessBy.get(p.id) ?? []).map((s) => ({
      at: s.occurredAt, type: s.sessionType, durationMinutes: s.durationMinutes, rating: s.candidateRating,
      dimensions: Object.fromEntries(DIMENSIONS.map((d, i) => [d, [s.dimTargetingStatus, s.dimMotivationStatus, s.dimNetworkingStatus, s.dimApplicationVolumeStatus, s.dimSkillsStatus, s.dimNarrativeStatus, s.dimInterviewPracticeStatus][i] ?? null])),
    }))
    const added: ContactFact[] = (contactBy.get(p.id) ?? []).map((c) => ({ at: c.createdAt, warmth: c.warmth, source: c.source, category: c.category }))

    return {
      id: p.id,
      registeredAt: p.registrationCompletedAt!,

      seniority: seniority.get(p.id) ?? seniorityFromYears(p.yearsExperience),
      yearsExperience: p.yearsExperience,
      education: p.highestEducationLevel,
      schools: distinct(edu.map((e) => e.school?.name ?? e.schoolName)),
      fieldsOfStudy: distinct(edu.map((e) => e.fieldOfStudy)),
      ageBand: p.ageBand,
      state: p.currentState,
      country: p.currentCountry,
      metro: p.metroArea,
      fn: p.primaryFunction,
      industry: p.industryBucket ?? p.industryContext,
      currentEmployers: distinct(currentJobs.map((j) => j.companyName)),
      formerEmployers: distinct(jobs.filter((j) => !j.isCurrent).map((j) => j.companyName)),
      jobStatus: p.currentJobStatus,
      journey: p.journey,
      leadSource: p.leadSource,
      trajectory: p.careerTrajectory,
      isPivoting: p.isPivoting,

      targetRoleType: p.targetRoleType,
      targetFunction: p.targetFunction,
      targetIndustries: p.targetIndustries,
      remotePreference: p.remotePreference,
      openToRelocation: p.openToRelocation,
      willingToStartLower: p.willingToStartLower,
      interimInterest: p.interimConsultingInterest,
      targetCompanySize: p.targetCompanySize,
      targetCompanyStage: p.targetCompanyStage,
      targetCompMin: p.targetCompMin,
      applicationVolumeGoal: p.applicationVolumeGoal,
      outreachTargetPerWeek: p.networkingOutreachTargetPerWeek,
      searchIntensity: p.searchIntensity,
      searchIntensityScore: p.jobSearchIntensity,
      changeReadiness: p.changeReadiness,
      gapDuration: p.gapDuration,
      confidential: p.confidentialSearchMode,
      motivations: p.motivations,
      blockers: p.blockers,
      barriers: p.biggestBarriers,
      networkingConcerns: p.networkingConcerns,
      connectPreferences: p.networkConnectPreferences,
      strengths: p.topStrengths,
      growthAreas: p.growthAreas,
      skillsToBuild: p.skillsToBuild,

      coachingStylePreference: p.coachingStylePreference,
      changePace: p.changePacePreference,
      topCoachingStyles: styleBy.get(p.id) ?? [],
      notificationTier: p.notificationTier,
      networkComfort: p.networkComfortLevel,
      disclosureComfort: p.publicDisclosureComfort,
      networkingLevel: p.networkingLevel,
      storyComfort: p.storyComfort,
      interviewComfort: p.interviewComfort,
      pitchReady: p.elevatorPitchReady,
      negotiationComfort: p.negotiationComfort,
      hasCoach: !!p.coachId,

      resumeUploaded: (resumeCount.get(p.id) ?? 0) > 0,
      resumeStepComplete: p.resumeStepComplete,
      assessmentComplete: p.assessmentComplete,
      contractAccepted: p.contractAccepted,
      trackRecordDone: !!p.trackRecordCompletedAt,
      whatINeedDone: !!p.whatINeedCompletedAt,
      skillsAssessmentDone: !!p.skillsAssessmentCompletedAt,
      strategyConfirmed: !!p.searchStrategyConfirmedAt,
      referencesRequested: refs.length,
      referencesCompleted: refs.filter((r) => r.completedAt).length,
      recruiterOptIn: p.recruiterDatabaseOptIn,
      resumeBookOptIn: p.resumeBookOptIn,
      leaderboardOptIn: p.leaderboardOptIn,
      grade: score?.grade ?? null,
      composite: score?.compositeScore ?? null,
      components: {
        experience: score?.experienceScore ?? null, resume: score?.resumeScore ?? null, evidence: score?.evidenceScore ?? null,
        effort: score?.effortScore ?? null, market: score?.marketScore ?? null,
      },
      currentStreak: p.currentStreak,
      membershipPlan: mem?.planKey ?? null,
      membershipStatus: mem?.status ?? null,
      contactsTotal: totalContacts.get(p.id) ?? 0,

      logins: (loginBy.get(p.id) ?? []).map((l) => l.createdAt),
      applications: apps,
      outreach: (outBy.get(p.id) ?? []).map((o) => ({ at: o.loggedAt, channel: o.channel })),
      linkedinPosts: (liBy.get(p.id) ?? []).map((l) => l.loggedAt),
      communityPosts: (comBy.get(p.id) ?? []).map((c) => c.createdAt),
      checkIns: (ciBy.get(p.id) ?? []).map((c) => ({ at: c.checkedInAt, mood: c.mood })),
      sprintWeeks: (spBy.get(p.id) ?? []).map((s) => s.weekStartDate),
      courses: (courseBy.get(p.id) ?? []).map((c) => ({ at: c.detectedAt, status: c.status })),
      coachSessions: sess,
      contactsAdded: added,
      referenceRequests: refs.filter((r) => r.requestedAt >= since && r.requestedAt < until).map((r) => r.requestedAt),
      referenceCompletions: refs.filter((r) => r.completedAt && r.completedAt >= since && r.completedAt < until).map((r) => r.completedAt!),
      hires: (hireBy.get(p.id) ?? []).map((h) => h.startDate),
      recruiterIntros: (introBy.get(p.id) ?? []).map((i) => i.createdAt),
      recruiterSubmissions: (subBy.get(p.id) ?? []).map((s) => s.createdAt),
      recruiterPlacements: (plBy.get(p.id) ?? []).map((x) => x.placedAt),
      gradeFirst: snaps[0]?.grade ?? null,
      gradeLast: snaps.length > 1 ? snaps[snaps.length - 1].grade : null,
    }
  })

  return {
    members,
    waitlistSignups: waitlist.filter((w) => w.createdAt >= current.start).length,
    waitlistSignupsPrior: waitlist.filter((w) => w.createdAt < current.start).length,
  }
}
