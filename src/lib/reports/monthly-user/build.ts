import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import type { MemberFacts, ReportInput } from './facts'
import { memberMonth, type MemberMonth, type Win } from './month-metrics'
import { inWindow, type MonthWindow } from './period'
import {
  band, compareGroups, distribution, mean, median, multiDistribution, pct, relationship, round1,
} from './stats'
import {
  humanize, labelAge, labelChannel, labelEducation, labelJobStatus, labelSearchIntensity, labelSeniority,
} from './labels'
import type {
  Block, ComparisonRow, Insight, Kpi, MonthlyUserReportData, Section, StatRow, Unit,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const WARM_CHANNELS = new Set(['REFERRAL', 'WARM_NETWORK_INTRO', 'RECRUITER_OUTREACH'])
const GRADE_RANK: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 }
const POSITIVE_MOODS = new Set(['MOVING', 'FIRED_UP'])

interface Row { m: MemberFacts; mm: MemberMonth; tenureDays: number }

export interface BuildArgs {
  input: ReportInput
  current: MonthWindow
  prior: MonthWindow
  /** KPI values from the previously stored report, used where a measure has no history to recompute. */
  storedPriorKpis: Record<string, number | null>
  now: Date
}

const stat = (label: string, value: number | null, unit: Unit, prior?: number | null, note?: string): StatRow => ({ label, value, unit, prior, note })
const dist = (title: string, d: ReturnType<typeof distribution>, note?: string): Block => ({ kind: 'distribution', title, dist: d, note })
const stats = (title: string, rows: StatRow[], note?: string): Block => ({ kind: 'stats', title, rows, note })

function rowsFor(members: MemberFacts[], w: Win): Row[] {
  return members.map((m) => ({ m, mm: memberMonth(m, w), tenureDays: Math.max(0, Math.floor((w.end.getTime() - m.registeredAt.getTime()) / DAY_MS)) }))
}

// ── Headline measures, computed the same way for any month ──────────────

function kpisFor(members: MemberFacts[], w: MonthWindow): Record<string, number | null> {
  const cohort = members.filter((m) => m.registeredAt < w.end)
  const rows = rowsFor(cohort, w)
  const active = rows.filter((r) => r.mm.active)
  const applicants = rows.filter((r) => r.mm.applications > 0)
  const checkIns = cohort.flatMap((m) => m.checkIns.filter((c) => inWindow(c.at, w)))
  const sessions = cohort.flatMap((m) => m.coachSessions.filter((s) => inWindow(s.at, w)))
  const ratings = sessions.map((s) => s.rating).filter((r): r is number => r !== null)
  return {
    members: cohort.length,
    new_members: cohort.filter((m) => inWindow(m.registeredAt, w)).length,
    active_members: active.length,
    active_share: pct(active.length, rows.length),
    applications: rows.reduce((s, r) => s + r.mm.applications, 0),
    median_applications: median(applicants.map((r) => r.mm.applications)),
    interviewing_members: rows.filter((r) => r.mm.interviews > 0).length,
    interview_rate: pct(applicants.filter((r) => r.mm.interviews > 0).length, applicants.length),
    offer_members: rows.filter((r) => r.mm.offers > 0).length,
    hires: rows.reduce((s, r) => s + r.mm.hires, 0),
    outreach: rows.reduce((s, r) => s + r.mm.outreach, 0),
    new_contacts: rows.reduce((s, r) => s + r.mm.newContacts, 0),
    check_ins: checkIns.length,
    positive_mood_share: pct(checkIns.filter((c) => POSITIVE_MOODS.has(c.mood)).length, checkIns.length),
    coach_sessions: sessions.length,
    members_coached: rows.filter((r) => r.mm.coachSessions > 0).length,
    coach_rating: mean(ratings),
  }
}

const KPI_META: Array<{ key: string; label: string; unit: Unit }> = [
  { key: 'members', label: 'Members', unit: 'count' },
  { key: 'new_members', label: 'New members', unit: 'count' },
  { key: 'active_members', label: 'Active members', unit: 'count' },
  { key: 'active_share', label: 'Share active', unit: 'pct' },
  { key: 'applications', label: 'Applications', unit: 'count' },
  { key: 'median_applications', label: 'Median applications per applicant', unit: 'count' },
  { key: 'interviewing_members', label: 'Members with an interview', unit: 'count' },
  { key: 'interview_rate', label: 'Applicants who got an interview', unit: 'pct' },
  { key: 'offer_members', label: 'Members with an offer', unit: 'count' },
  { key: 'hires', label: 'Hires confirmed', unit: 'count' },
  { key: 'outreach', label: 'Outreach messages logged', unit: 'count' },
  { key: 'new_contacts', label: 'New network contacts', unit: 'count' },
  { key: 'check_ins', label: 'Daily check-ins', unit: 'count' },
  { key: 'positive_mood_share', label: 'Check-ins moving or fired up', unit: 'pct' },
  { key: 'coach_sessions', label: 'Coaching sessions', unit: 'count' },
  { key: 'members_coached', label: 'Members coached', unit: 'count' },
  { key: 'coach_rating', label: 'Average coaching rating (1–5)', unit: 'score' },
]
const HEADLINE_KEYS = ['members', 'new_members', 'active_share', 'applications', 'interview_rate', 'hires', 'outreach', 'members_coached']

/** KPI values a later report can compare itself to. */
export function trendKpis(members: MemberFacts[], w: MonthWindow): Record<string, number | null> {
  return kpisFor(members, w)
}

// ── Sections ─────────────────────────────────────────────────────────

function whoSection(members: MemberFacts[]): Section {
  const yearsBand = (m: MemberFacts) =>
    band(m.yearsExperience, [{ max: 4, label: '0–4 years' }, { max: 9, label: '5–9 years' }, { max: 14, label: '10–14 years' }, { max: 19, label: '15–19 years' }], '20+ years')
  return {
    id: 'who', title: 'Who our members are',
    intro: 'Seniority, education, schools, and background of everyone registered at the end of the month.',
    blocks: [
      dist('Seniority', distribution(members.map((m) => m.seniority), { label: labelSeniority }), 'From resume analysis; falls back to years of experience.'),
      dist('Years of experience', distribution(members.map(yearsBand))),
      dist('Highest education', distribution(members.map((m) => m.education), { label: labelEducation })),
      dist('Universities attended', multiDistribution(members.map((m) => m.schools), { topN: 15 }), 'Each member counts once per school.'),
      dist('Fields of study', multiDistribution(members.map((m) => m.fieldsOfStudy), { topN: 12 })),
      dist('Age band', distribution(members.map((m) => m.ageBand), { label: labelAge })),
      dist('Career trajectory', distribution(members.map((m) => m.trajectory), { label: humanize })),
      dist('Where they are now', distribution(members.map((m) => m.jobStatus), { label: labelJobStatus })),
      dist('Journey', distribution(members.map((m) => m.journey), { label: humanize })),
      dist('How they found NextChapter', distribution(members.map((m) => m.leadSource), { label: humanize })),
    ],
  }
}

function geoIndustrySection(members: MemberFacts[]): Section {
  return {
    id: 'geo-industry', title: 'Geography, industry and function',
    intro: 'Where members live, and the industries and functions they come from and are aiming for.',
    blocks: [
      dist('State', distribution(members.map((m) => m.state), { topN: 15 })),
      dist('Metro area', distribution(members.map((m) => m.metro), { topN: 15 })),
      dist('Country', distribution(members.map((m) => m.country), { topN: 8 })),
      dist('Current industry', distribution(members.map((m) => m.industry), { topN: 15 })),
      dist('Current function', distribution(members.map((m) => m.fn), { topN: 15 })),
      dist('Target function', distribution(members.map((m) => m.targetFunction), { topN: 15 })),
      dist('Target industries', multiDistribution(members.map((m) => m.targetIndustries), { topN: 15 })),
      dist('Target role type', distribution(members.map((m) => m.targetRoleType), { label: humanize })),
    ],
  }
}

function companiesSection(members: MemberFacts[], rows: Row[], w: Win): Section {
  const appliedTo = rows.map((r) => r.m.applications.filter((a) => inWindow(a.appliedAt, w)).map((a) => a.company))
  return {
    id: 'companies', title: 'Companies',
    intro: 'Where members work or worked, and which companies they went after this month.',
    blocks: [
      dist('Current employers', multiDistribution(members.map((m) => m.currentEmployers), { topN: 15 })),
      dist('Former employers (alumni communities)', multiDistribution(members.map((m) => m.formerEmployers), { topN: 20 })),
      dist('Companies applied to this month', multiDistribution(appliedTo, { topN: 15 }), 'Members who applied, counted once per company.'),
    ],
  }
}

function progressSection(members: MemberFacts[]): Section {
  const n = members.length
  const share = (f: (m: MemberFacts) => boolean) => pct(members.filter(f).length, n)
  const graded = members.filter((m) => m.grade)
  const comp = (pick: (m: MemberFacts) => number | null) => mean(members.map(pick).filter((v): v is number => v !== null))
  const moved = members.filter((m) => m.gradeFirst && m.gradeLast && m.gradeFirst in GRADE_RANK && m.gradeLast in GRADE_RANK)
  const improved = moved.filter((m) => GRADE_RANK[m.gradeLast!] > GRADE_RANK[m.gradeFirst!]).length
  const declined = moved.filter((m) => GRADE_RANK[m.gradeLast!] < GRADE_RANK[m.gradeFirst!]).length
  const movementOk = moved.length >= MIN_CELL_SIZE
  return {
    id: 'progress', title: 'Progress',
    intro: 'How far members have come through onboarding, evidence-building and their Market Reality grade.',
    blocks: [
      stats('Milestones reached (share of members)', [
        stat('Uploaded a resume', share((m) => m.resumeUploaded), 'pct'),
        stat('Finished the resume step', share((m) => m.resumeStepComplete), 'pct'),
        stat('Completed the assessment', share((m) => m.assessmentComplete), 'pct'),
        stat('Accepted the contract', share((m) => m.contractAccepted), 'pct'),
        stat('Completed the track record', share((m) => m.trackRecordDone), 'pct'),
        stat('Completed "what I need"', share((m) => m.whatINeedDone), 'pct'),
        stat('Completed the skills assessment', share((m) => m.skillsAssessmentDone), 'pct'),
        stat('Confirmed a search strategy', share((m) => m.strategyConfirmed), 'pct'),
        stat('Requested at least one reference', share((m) => m.referencesRequested > 0), 'pct'),
        stat('Has a completed reference', share((m) => m.referencesCompleted > 0), 'pct'),
        stat('Opted in to the recruiter database', share((m) => m.recruiterOptIn), 'pct'),
        stat('Opted in to the resume book', share((m) => m.resumeBookOptIn), 'pct'),
      ]),
      dist('Market Reality grade', distribution(members.map((m) => m.grade)), `${graded.length} of ${n} members have a grade.`),
      stats('Average grade components (0–100)', [
        stat('Composite', comp((m) => m.composite), 'score'),
        stat('Experience', comp((m) => m.components.experience), 'score'),
        stat('Resume', comp((m) => m.components.resume), 'score'),
        stat('Evidence', comp((m) => m.components.evidence), 'score'),
        stat('Effort', comp((m) => m.components.effort), 'score'),
        stat('Market', comp((m) => m.components.market), 'score'),
      ]),
      stats('Grade movement this month', movementOk ? [
        stat('Members whose grade rose', pct(improved, moved.length), 'pct'),
        stat('Members whose grade fell', pct(declined, moved.length), 'pct'),
        stat('Members whose grade held', pct(moved.length - improved - declined, moved.length), 'pct'),
      ] : [], movementOk ? `Among ${moved.length} members graded at least twice this month.` : 'Not enough members were graded twice this month to show movement.'),
    ],
  }
}

function goalsSection(members: MemberFacts[]): Section {
  const n = members.length
  const share = (f: (m: MemberFacts) => boolean) => pct(members.filter(f).length, n)
  const comp = (v: number | null) => band(v, [{ max: 99_999, label: 'Under $100k' }, { max: 149_999, label: '$100k–$150k' }, { max: 199_999, label: '$150k–$200k' }, { max: 299_999, label: '$200k–$300k' }], '$300k+')
  return {
    id: 'goals', title: 'Search goals and signals',
    intro: 'What members say they want, how urgently, and what is in their way.',
    blocks: [
      dist('Search intensity', distribution(members.map((m) => m.searchIntensity), { label: labelSearchIntensity })),
      dist('Readiness for change', distribution(members.map((m) => m.changeReadiness), { label: humanize })),
      dist('How long they have been out of work', distribution(members.map((m) => m.gapDuration), { label: humanize })),
      dist('Minimum compensation target', distribution(members.map((m) => comp(m.targetCompMin)))),
      dist('Target company size', distribution(members.map((m) => m.targetCompanySize), { label: humanize })),
      dist('Target company stage', distribution(members.map((m) => m.targetCompanyStage), { label: humanize })),
      dist('Remote preference', distribution(members.map((m) => m.remotePreference), { label: humanize })),
      stats('Flexibility and posture (share of members)', [
        stat('Open to relocating', share((m) => m.openToRelocation), 'pct'),
        stat('Willing to start lower', share((m) => m.willingToStartLower), 'pct'),
        stat('Interested in interim or consulting work', share((m) => m.interimInterest), 'pct'),
        stat('Pivoting to a new field', share((m) => m.isPivoting), 'pct'),
        stat('Searching confidentially', share((m) => m.confidential), 'pct'),
      ]),
      stats('Self-set targets', [
        stat('Median weekly application goal', median(members.map((m) => m.applicationVolumeGoal).filter((v): v is number => v !== null)), 'count'),
        stat('Median weekly outreach goal', median(members.map((m) => m.outreachTargetPerWeek).filter((v): v is number => v !== null)), 'count'),
      ]),
      dist('What motivates them', multiDistribution(members.map((m) => m.motivations), { label: humanize })),
      dist('What is blocking them', multiDistribution(members.map((m) => m.blockers), { label: humanize })),
      dist('Biggest barriers', multiDistribution(members.map((m) => m.barriers), { label: humanize })),
      dist('Top strengths', multiDistribution(members.map((m) => m.strengths), { topN: 12 })),
      dist('Growth areas', multiDistribution(members.map((m) => m.growthAreas), { topN: 12 })),
      dist('Skills they want to build', multiDistribution(members.map((m) => m.skillsToBuild), { topN: 12 })),
    ],
  }
}

function activitySection(rows: Row[], prevRows: Row[], w: MonthWindow): Section {
  const sum = (rs: Row[], f: (mm: MemberMonth) => number) => rs.reduce((s, r) => s + f(r.mm), 0)
  const activeRows = rows.filter((r) => r.mm.active)
  const totalsRow = (label: string, f: (mm: MemberMonth) => number): StatRow => stat(label, sum(rows, f), 'count', sum(prevRows, f))
  const perActive = (label: string, f: (mm: MemberMonth) => number): StatRow =>
    stat(label, activeRows.length >= MIN_CELL_SIZE ? median(activeRows.map((r) => f(r.mm))) : null, 'count')
  const weeks = (w.end.getTime() - w.start.getTime()) / (7 * DAY_MS)
  const withTarget = rows.filter((r) => r.m.outreachTargetPerWeek && r.m.outreachTargetPerWeek > 0)
  const metTarget = withTarget.filter((r) => r.mm.outreach >= r.m.outreachTargetPerWeek! * weeks)
  const apps = rows.flatMap((r) => r.m.applications.filter((a) => inWindow(a.appliedAt, w)))
  const byChannel = compareGroups(
    apps, (a) => (a.channel ? labelChannel(a.channel) : null),
    [
      { key: 'apps', label: 'Applications', unit: 'count', compute: (g) => g.length },
      { key: 'interview', label: 'Reached an interview', unit: 'pct', compute: (g) => pct(g.filter((a) => a.interviewAt).length, g.length) },
      { key: 'offer', label: 'Reached an offer', unit: 'pct', compute: (g) => pct(g.filter((a) => a.offerAt).length, g.length) },
    ],
  )
  return {
    id: 'activity', title: 'Effort, activity and strategy',
    intro: 'What members actually did this month, which channels they used, and which of them worked.',
    blocks: [
      stats('Totals this month', [
        totalsRow('Applications submitted', (m) => m.applications),
        totalsRow('Jobs saved to track', (m) => m.tracked),
        totalsRow('Interviews landed', (m) => m.interviews),
        totalsRow('Offers received', (m) => m.offers),
        totalsRow('Applications declined', (m) => m.declines),
        totalsRow('Outreach messages logged', (m) => m.outreach),
        totalsRow('LinkedIn posts logged', (m) => m.linkedin),
        totalsRow('Community posts', (m) => m.community),
        totalsRow('Daily check-ins', (m) => m.checkIns),
        totalsRow('Courses started or completed', (m) => m.courses),
      ]),
      stats('Typical active member (median)', [
        perActive('Applications', (m) => m.applications),
        perActive('Outreach messages', (m) => m.outreach),
        perActive('Check-ins', (m) => m.checkIns),
        perActive('Logins', (m) => m.logins),
      ], `Among ${activeRows.length} members with any activity.`),
      dist('Effort level', distribution(rows.map((r) => band(r.mm.effort, [{ max: 0, label: 'None' }, { max: 9, label: 'Light (1–9 actions)' }, { max: 29, label: 'Steady (10–29)' }], 'Heavy (30+)'))), 'Applications + outreach + posts + check-ins.'),
      stats('Following their own plan', [
        stat('Members who met their weekly outreach goal', withTarget.length >= MIN_CELL_SIZE ? pct(metTarget.length, withTarget.length) : null, 'pct', null, `Of ${withTarget.length} members who set one.`),
        stat('Members who logged any activity', pct(activeRows.length, rows.length), 'pct', pct(prevRows.filter((r) => r.mm.active).length, prevRows.length)),
      ]),
      dist('Application channels', distribution(apps.map((a) => (a.channel ? labelChannel(a.channel) : null))), 'Counts applications, not members.'),
      { kind: 'comparison', title: 'Which channels led to interviews', note: 'Applications submitted this month, followed through to today.', ...byChannel },
      dist('Outreach by channel', distribution(rows.flatMap((r) => r.m.outreach.filter((o) => inWindow(o.at, w)).map((o) => humanize(o.channel)))), 'Counts messages, not members.'),
      dist('Mood at check-in', distribution(rows.flatMap((r) => r.m.checkIns.filter((c) => inWindow(c.at, w)).map((c) => humanize(c.mood)))), 'Counts check-ins, not members.'),
    ],
  }
}

function networkingSection(rows: Row[], w: MonthWindow): Section {
  const members = rows.map((r) => r.m)
  const n = rows.length
  const share = (f: (r: Row) => boolean) => pct(rows.filter(f).length, n)
  const added = rows.flatMap((r) => r.m.contactsAdded.filter((c) => inWindow(c.at, w)))
  return {
    id: 'networking', title: 'Networking',
    intro: 'How members build and use their network, and how they feel about it.',
    blocks: [
      stats('Network activity', [
        stat('Median contacts in a member\'s network', median(members.map((m) => m.contactsTotal)), 'count'),
        stat('Members who logged outreach this month', share((r) => r.mm.outreach > 0), 'pct'),
        stat('Members who added a contact this month', share((r) => r.mm.newContacts > 0), 'pct'),
        stat('Members with a LinkedIn post this month', share((r) => r.mm.linkedin > 0), 'pct'),
        stat('Members with a community post this month', share((r) => r.mm.community > 0), 'pct'),
      ]),
      dist('Contacts added: warmth', distribution(added.map((c) => humanize(c.warmth))), 'Counts contacts, not members.'),
      dist('Contacts added: how they got here', distribution(added.map((c) => humanize(c.source))), 'Counts contacts, not members.'),
      dist('Contacts added: relationship', distribution(added.map((c) => (c.category ? humanize(c.category) : null))), 'Counts contacts, not members.'),
      dist('How much they network today', distribution(members.map((m) => m.networkingLevel === null ? null : ['Not much', 'Some, should do more', 'A lot', "Can't do more"][m.networkingLevel - 1] ?? null))),
      dist('Comfort reaching out', distribution(members.map((m) => m.networkComfort), { label: humanize })),
      dist('What worries them about networking', multiDistribution(members.map((m) => m.networkingConcerns), { label: humanize })),
      dist('How they prefer to connect', multiDistribution(members.map((m) => m.connectPreferences), { label: humanize })),
      dist('Comfort being visible', distribution(members.map((m) => m.disclosureComfort), { label: humanize })),
    ],
  }
}

function coachingSection(rows: Row[], prevRows: Row[], w: MonthWindow, pw: MonthWindow, input: ReportInput): Section {
  const members = rows.map((r) => r.m)
  const sessions = members.flatMap((m) => m.coachSessions.filter((s) => inWindow(s.at, w)))
  const prevSessions = prevRows.flatMap((r) => r.m.coachSessions.filter((s) => inWindow(s.at, pw)))
  const ratings = sessions.map((s) => s.rating).filter((r): r is number => r !== null)
  const enough = sessions.length >= MIN_CELL_SIZE
  const dimRows: ComparisonRow[] = []
  let hidden = 0
  const dims = [...new Set(sessions.flatMap((s) => Object.keys(s.dimensions)))]
  for (const d of dims) {
    const statuses = sessions.map((s) => s.dimensions[d]).filter((v): v is string => !!v)
    if (statuses.length < MIN_CELL_SIZE) { hidden++; continue }
    dimRows.push({
      label: d, n: statuses.length,
      values: {
        onTrack: pct(statuses.filter((s) => s === 'ON_TRACK').length, statuses.length),
        atRisk: pct(statuses.filter((s) => s === 'AT_RISK').length, statuses.length),
        stalled: pct(statuses.filter((s) => s === 'STALLED').length, statuses.length),
      },
    })
  }
  return {
    id: 'coaching', title: 'Coaching and style',
    intro: 'Who is being coached, what coaches see as stuck, and how members prefer to be coached.',
    blocks: [
      stats('Coaching this month', [
        stat('Members with a coach', pct(members.filter((m) => m.hasCoach).length, members.length), 'pct'),
        stat('Sessions held', sessions.length, 'count', prevSessions.length),
        stat('Members coached', rows.filter((r) => r.mm.coachSessions > 0).length, 'count', prevRows.filter((r) => r.mm.coachSessions > 0).length),
        stat('Average session length (minutes)', enough ? mean(sessions.map((s) => s.durationMinutes).filter((v): v is number => v !== null)) : null, 'score'),
        stat('Average member rating (1–5)', ratings.length >= MIN_CELL_SIZE ? mean(ratings) : null, 'score'),
        stat('Coaching waitlist sign-ups', input.waitlistSignups, 'count', input.waitlistSignupsPrior),
      ]),
      dist('Session types', distribution(sessions.map((s) => humanize(s.type))), 'Counts sessions, not members.'),
      { kind: 'comparison', title: 'Where coaches see members stuck', note: 'Status coaches recorded for each part of the search, per session.', columns: [
        { key: 'onTrack', label: 'On track', unit: 'pct' }, { key: 'atRisk', label: 'At risk', unit: 'pct' }, { key: 'stalled', label: 'Stalled', unit: 'pct' },
      ], rows: dimRows.sort((a, b) => (b.values.stalled ?? 0) + (b.values.atRisk ?? 0) - ((a.values.stalled ?? 0) + (a.values.atRisk ?? 0))), hiddenGroups: hidden },
      dist('Preferred coaching style', distribution(members.map((m) => m.coachingStylePreference), { label: humanize })),
      dist('Coaching style profile (top styles)', multiDistribution(members.map((m) => m.topCoachingStyles), { label: humanize })),
      dist('Preferred pace of change', distribution(members.map((m) => m.changePace), { label: humanize })),
      dist('Notification preference', distribution(members.map((m) => m.notificationTier), { label: humanize })),
      dist('Membership plan', distribution(members.map((m) => m.membershipPlan), { label: humanize })),
      dist('Membership status', distribution(members.map((m) => m.membershipStatus), { label: humanize })),
      stats('Confidence (average, 1–4 scale)', [
        stat('Telling their story', mean(members.map((m) => m.storyComfort).filter((v): v is number => v !== null)), 'score'),
        stat('Interviewing', mean(members.map((m) => m.interviewComfort).filter((v): v is number => v !== null)), 'score'),
        stat('Elevator pitch', mean(members.map((m) => m.pitchReady).filter((v): v is number => v !== null)), 'score'),
        stat('Negotiating', mean(members.map((m) => m.negotiationComfort).filter((v): v is number => v !== null)), 'score'),
      ]),
    ],
  }
}

function recruitingOutcomesSection(rows: Row[], prevRows: Row[]): Section {
  const touched = (rs: Row[], f: (m: MemberFacts) => number) => rs.filter((r) => f(r.m) > 0).length
  const hired = rows.filter((r) => r.mm.hires > 0)
  const daysToHire = hired.map((r) => {
    const start = r.m.hires.find((d) => d >= new Date(r.m.registeredAt))
    return start ? Math.max(0, Math.round((start.getTime() - r.m.registeredAt.getTime()) / DAY_MS)) : null
  }).filter((v): v is number => v !== null)
  return {
    id: 'recruiting-outcomes', title: 'Recruiters and outcomes',
    intro: 'Recruiter interest in members, and who landed where.',
    blocks: [
      stats('Recruiter activity (members involved)', [
        stat('Opted in to the recruiter database', pct(rows.filter((r) => r.m.recruiterOptIn).length, rows.length), 'pct'),
        stat('Members with a new recruiter introduction', touched(rows, (m) => m.recruiterIntros.length), 'count', touched(prevRows, (m) => m.recruiterIntros.length)),
        stat('Members submitted to a role by a recruiter', touched(rows, (m) => m.recruiterSubmissions.length), 'count', touched(prevRows, (m) => m.recruiterSubmissions.length)),
        stat('Members placed by a recruiter', touched(rows, (m) => m.recruiterPlacements.length), 'count', touched(prevRows, (m) => m.recruiterPlacements.length)),
      ], 'A month is counted on the date each introduction, submission or placement was created.'),
      stats('Outcomes this month', [
        stat('Members with an interview', rows.filter((r) => r.mm.interviews > 0).length, 'count', prevRows.filter((r) => r.mm.interviews > 0).length),
        stat('Members with an offer', rows.filter((r) => r.mm.offers > 0).length, 'count', prevRows.filter((r) => r.mm.offers > 0).length),
        stat('Hires confirmed', hired.length, 'count', prevRows.filter((r) => r.mm.hires > 0).length),
        stat('Median days from joining to start date', daysToHire.length >= MIN_CELL_SIZE ? median(daysToHire) : null, 'days', null, `Among ${daysToHire.length} confirmed hires.`),
      ]),
    ],
  }
}

function correlationsSection(rows: Row[]): Section {
  const columns = [
    { key: 'active', label: 'Active', unit: 'pct' as const, compute: (g: Row[]) => pct(g.filter((r) => r.mm.active).length, g.length) },
    { key: 'apps', label: 'Applications per member', unit: 'ratio' as const, compute: (g: Row[]) => mean(g.map((r) => r.mm.applications)) },
    { key: 'interview', label: 'Got an interview', unit: 'pct' as const, compute: (g: Row[]) => pct(g.filter((r) => r.mm.interviews > 0).length, g.length) },
    { key: 'offer', label: 'Got an offer', unit: 'pct' as const, compute: (g: Row[]) => pct(g.filter((r) => r.mm.offers > 0).length, g.length) },
    { key: 'composite', label: 'Average grade score', unit: 'score' as const, compute: (g: Row[]) => mean(g.map((r) => r.m.composite).filter((v): v is number => v !== null)) },
  ]
  const cmp = (title: string, groupOf: (r: Row) => string | null, note?: string, topN = 8): Block => ({
    kind: 'comparison', title, note, ...compareGroups(rows, groupOf, columns, { topN }),
  })
  const warmShare = (r: Row) => {
    const apps = r.m.applications.filter((a) => a.appliedAt)
    if (apps.length === 0) return null
    return apps.some((a) => a.channel && WARM_CHANNELS.has(a.channel)) ? 'Used a warm channel' : 'Cold applications only'
  }
  const pairs = (f: (r: Row) => [number | null, number | null]): Array<[number, number]> =>
    rows.map(f).filter((p): p is [number, number] => p[0] !== null && p[1] !== null)
  const relationships = [
    relationship('Outreach messages', 'Interviews landed', pairs((r) => [r.mm.outreach, r.mm.interviews])),
    relationship('Applications submitted', 'Interviews landed', pairs((r) => [r.mm.applications, r.mm.interviews])),
    relationship('New network contacts', 'Interviews landed', pairs((r) => [r.mm.newContacts, r.mm.interviews])),
    relationship('How much they network today', 'Interviews landed', pairs((r) => [r.m.networkingLevel, r.mm.interviews])),
    relationship('Interview confidence', 'Interviews landed', pairs((r) => [r.m.interviewComfort, r.mm.interviews])),
    relationship('Coaching sessions', 'Applications submitted', pairs((r) => [r.mm.coachSessions, r.mm.applications])),
    relationship('Daily check-ins', 'Applications submitted', pairs((r) => [r.mm.checkIns, r.mm.applications])),
    relationship('Self-rated search intensity', 'Applications submitted', pairs((r) => [r.m.searchIntensityScore, r.mm.applications])),
    relationship('Check-in streak', 'Applications submitted', pairs((r) => [r.m.currentStreak, r.mm.applications])),
    relationship('Days on the platform', 'Average grade score', pairs((r) => [r.tenureDays, r.m.composite])),
    relationship('Effort this month', 'Average grade score', pairs((r) => [r.mm.effort, r.m.composite])),
  ]
  return {
    id: 'correlations', title: 'What goes with what',
    intro: 'Comparisons across the membership. These show association, not cause: members who do more may simply be the ones who were already further along.',
    blocks: [
      cmp('By coaching', (r) => (r.m.hasCoach ? 'Has a coach' : 'No coach')),
      cmp('By how they apply', warmShare, 'Among members who applied this month.'),
      cmp('By outreach volume', (r) => band(r.mm.outreach, [{ max: 0, label: 'No outreach' }, { max: 4, label: '1–4 messages' }, { max: 14, label: '5–14 messages' }], '15+ messages')),
      cmp('By time on the platform', (r) => band(r.tenureDays, [{ max: 29, label: 'Under 30 days' }, { max: 89, label: '30–89 days' }, { max: 179, label: '90–179 days' }], '180+ days')),
      cmp('By seniority', (r) => (r.m.seniority ? labelSeniority(r.m.seniority) : null)),
      cmp('By education', (r) => (r.m.education ? labelEducation(r.m.education) : null)),
      cmp('By where they are now', (r) => (r.m.jobStatus ? labelJobStatus(r.m.jobStatus) : null)),
      cmp('By search intensity', (r) => (r.m.searchIntensity ? labelSearchIntensity(r.m.searchIntensity) : null)),
      cmp('By comfort reaching out', (r) => (r.m.networkComfort ? humanize(r.m.networkComfort) : null)),
      cmp('By preferred coaching style', (r) => (r.m.coachingStylePreference ? humanize(r.m.coachingStylePreference) : null)),
      cmp('By how they found us', (r) => (r.m.leadSource ? humanize(r.m.leadSource) : null)),
      cmp('By function', (r) => r.m.fn, undefined, 10),
      cmp('By searching confidentially', (r) => (r.m.confidential ? 'Confidential' : 'Open')),
      { kind: 'relationships', title: 'Rank correlations', note: 'Between −1 and 1. Shown only when at least 30 members have both measures.', rows: relationships },
    ],
  }
}

// ── Overview + insights ──────────────────────────────────────────────

function overviewSection(rows: Row[], kpis: Record<string, number | null>, prior: Record<string, number | null>): Section {
  return {
    id: 'overview', title: 'The membership',
    intro: 'Size, growth and how engaged members were this month.',
    blocks: [
      stats('Headlines', KPI_META.filter((k) => ['members', 'new_members', 'active_members', 'active_share', 'interviewing_members', 'offer_members', 'hires'].includes(k.key))
        .map((k) => stat(k.label, kpis[k.key], k.unit, prior[k.key]))),
      dist('Time on the platform', distribution(rows.map((r) => band(r.tenureDays, [{ max: 29, label: 'Under 30 days' }, { max: 89, label: '30–89 days' }, { max: 179, label: '90–179 days' }], '180+ days')))),
    ],
  }
}

function insightsFor(kpis: Record<string, number | null>, prior: Record<string, number | null>, correlations: Section): Insight[] {
  const out: Insight[] = []
  const delta = (k: string) => (kpis[k] !== null && prior[k] !== null && prior[k] !== undefined ? round1((kpis[k] as number) - (prior[k] as number)) : null)
  const label = (k: string) => KPI_META.find((m) => m.key === k)?.label ?? k

  const active = delta('active_share')
  if (active !== null && Math.abs(active) >= 3) {
    out.push({ tone: active > 0 ? 'good' : 'watch', sectionId: 'activity', title: `Share of members active ${active > 0 ? 'rose' : 'fell'} ${Math.abs(active)} points`, detail: `${kpis.active_share}% of members did something this month, against ${prior.active_share}% last month.` })
  }
  const interview = delta('interview_rate')
  if (interview !== null && Math.abs(interview) >= 3) {
    out.push({ tone: interview > 0 ? 'good' : 'watch', sectionId: 'activity', title: `Interview rate ${interview > 0 ? 'rose' : 'fell'} ${Math.abs(interview)} points`, detail: `${kpis.interview_rate}% of applicants landed an interview, against ${prior.interview_rate}% last month.` })
  }
  for (const k of ['new_members', 'applications', 'outreach', 'coach_sessions', 'hires']) {
    const now = kpis[k], before = prior[k]
    if (now === null || before === null || before === undefined || before < 10) continue
    const change = round1(((now - before) / before) * 100)
    if (Math.abs(change) >= 20) {
      out.push({ tone: change > 0 ? 'good' : 'watch', sectionId: 'activity', title: `${label(k)} ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}%`, detail: `${now} this month, ${before} last month.` })
    }
  }
  const rel = correlations.blocks.find((b) => b.kind === 'relationships')
  if (rel && rel.kind === 'relationships') {
    const strongest = rel.rows.filter((r) => r.rho !== null && (r.strength === 'moderate' || r.strength === 'strong')).sort((a, b) => Math.abs(b.rho!) - Math.abs(a.rho!))[0]
    if (strongest) {
      out.push({ tone: 'info', sectionId: 'correlations', title: `${strongest.a} and ${strongest.b.toLowerCase()} move ${strongest.rho! > 0 ? 'together' : 'in opposite directions'}`, detail: `Rank correlation ${strongest.rho} across ${strongest.n} members (${strongest.strength}). Association only, not proof of cause.` })
    }
  }
  const coach = correlations.blocks.find((b) => b.kind === 'comparison' && b.title === 'By coaching')
  if (coach && coach.kind === 'comparison') {
    const yes = coach.rows.find((r) => r.label === 'Has a coach'), no = coach.rows.find((r) => r.label === 'No coach')
    if (yes?.values.interview != null && no?.values.interview != null && Math.abs(yes.values.interview - no.values.interview) >= 5) {
      out.push({ tone: 'info', sectionId: 'correlations', title: `Coached members landed interviews ${yes.values.interview > no.values.interview ? 'more' : 'less'} often`, detail: `${yes.values.interview}% of coached members (${yes.n}) against ${no.values.interview}% of the rest (${no.n}). Coached members may differ in other ways.` })
    }
  }
  return out.slice(0, 8)
}

// ── Entry point ──────────────────────────────────────────────────────

export function buildReport({ input, current, prior, storedPriorKpis, now }: BuildArgs): Omit<MonthlyUserReportData, 'trend'> {
  const members = input.members.filter((m) => m.registeredAt < current.end)
  const prevMembers = input.members.filter((m) => m.registeredAt < prior.end)
  const rows = rowsFor(members, current)
  const prevRows = rowsFor(prevMembers, prior)

  const kpis = kpisFor(members, current)
  const recomputedPrior = kpisFor(input.members, prior)
  const priorKpis: Record<string, number | null> = { ...storedPriorKpis, ...recomputedPrior }

  const correlations = correlationsSection(rows)
  const sections: Section[] = [
    overviewSection(rows, kpis, priorKpis),
    whoSection(members),
    geoIndustrySection(members),
    companiesSection(members, rows, current),
    progressSection(members),
    goalsSection(members),
    activitySection(rows, prevRows, current),
    networkingSection(rows, current),
    coachingSection(rows, prevRows, current, prior, input),
    recruitingOutcomesSection(rows, prevRows),
    correlations,
  ]

  return {
    version: 1,
    monthKey: current.key,
    label: current.label,
    periodStart: current.start.toISOString(),
    periodEnd: current.end.toISOString(),
    generatedAt: now.toISOString(),
    minCellSize: MIN_CELL_SIZE,
    memberCount: members.length,
    headline: HEADLINE_KEYS.map((key) => {
      const meta = KPI_META.find((k) => k.key === key)!
      return { key, label: meta.label, unit: meta.unit, value: kpis[key], prior: priorKpis[key] ?? null } satisfies Kpi
    }),
    insights: insightsFor(kpis, priorKpis, correlations),
    sections,
  }
}
