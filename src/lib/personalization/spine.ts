// The personalization spine. For every journey and stage, what we ask, why, and
// what each answer drives: the plan, learning and development, networking, the
// opportunities we show, the report and the coaching. Nothing is asked that
// does not drive something, and what it drives must be read somewhere in the
// code (src/test/personalization-spine.test.ts checks that each file named in
// `readBy` exists and really reads the field). This is the single place that
// says how a question connects to an action and an opportunity.
//
// Pure and client-safe.

import type { JourneyStage, JourneyType } from '@/lib/journey/journey'

export type Group = 'who' | 'want' | 'how' | 'situation' | 'proof'
export type Drive = 'plan' | 'learning' | 'networking' | 'opportunities' | 'report' | 'coaching'

export const GROUP_LABELS: Record<Group, string> = {
  who: 'Who you are',
  want: 'What you want',
  how: 'How you work and want to be coached',
  situation: 'Your situation',
  proof: 'What you can show',
}

export const DRIVE_LABELS: Record<Drive, string> = {
  plan: 'Your weekly plan',
  learning: 'Learning and development',
  networking: 'Networking',
  opportunities: 'Opportunities',
  report: 'Your report',
  coaching: 'Coaching',
}

// A member's profile as the spine sees it: the stored fields, with dotted paths
// into JSON (journeyDetails.returnDate, cultureFit.importance).
export type ProfileLike = Record<string, unknown>

export type Needs = {
  journeys: readonly JourneyType[] | 'all'
  stages: readonly JourneyStage[] | 'all'
  // Only when an earlier answer makes it worth asking (culture details are skipped when culture does not matter).
  when?: (p: ProfileLike) => boolean
}

export interface Signal {
  key: string
  group: Group
  question: string
  // Where it is stored. The last segment (or `token`) must appear in every readBy file.
  field: string
  token?: string
  where: { label: string; href: string }
  needs: Needs
  drives: Partial<Record<Drive, string>>
  // What the answer can open for the member: a job, a company, a person, a course, a program.
  opportunity: string
  readBy: readonly string[]
}

const SEARCHING: readonly JourneyType[] = ['LAID_OFF', 'EXPLORING_MOVE', 'PROMOTION', 'CAREER_CHANGE', 'STUDENT_NEW_GRAD', 'RETURNING', 'NEXT_ACT']
const NOT_SEARCHING: readonly JourneyType[] = ['GROWING', 'ENTREPRENEUR', 'FRACTIONAL', 'TIME_OFF']
const ALL_STAGES_BUT_LANDED: readonly JourneyStage[] = ['EXPLORING', 'PREPARING', 'APPLYING', 'INTERVIEWING', 'OFFER']
const READY: readonly JourneyStage[] = ['PREPARING', 'APPLYING', 'INTERVIEWING', 'OFFER']

const ONBOARDING_CONFIRM = { label: 'Onboarding: confirm what we read', href: '/onboarding/confirm' }
const ONBOARDING_LOCATION = { label: 'Onboarding: where you can work', href: '/onboarding/location' }
const STRATEGY = { label: 'My Search Strategy', href: '/dashboard/search-strategy' }
const PRIVACY = { label: 'Your situation (Privacy)', href: '/dashboard/privacy' }

export function cultureMatters(p: ProfileLike): boolean {
  const v = get(p, 'cultureFit.importance')
  return v === 'SOMEWHAT' || v === 'VERY'
}

export const SIGNALS: readonly Signal[] = [
  // ── Who you are ───────────────────────────────────────────────────────────
  {
    key: 'level',
    group: 'who',
    question: 'What is the highest level you have reached?',
    field: 'highestLevelReached',
    where: ONBOARDING_CONFIRM,
    needs: { journeys: 'all', stages: 'all' },
    drives: {
      report: 'Judges how marketable you are at your level, not against everyone.',
      opportunities: 'Shows roles at and one step above your level, and hides the rest.',
      plan: 'Senior searches get unposted-role steps (outreach and recruiters); early-career gets alumni and first-résumé steps.',
    },
    opportunity: 'A shortlist of roles at your level, and the right kind of company for it.',
    readBy: ['src/components/dashboard/DossierReportSections.tsx', 'src/app/talent/(app)/candidates/page.tsx'],
  },
  {
    key: 'function',
    group: 'who',
    question: 'What function do you work in?',
    field: 'primaryFunction',
    where: ONBOARDING_CONFIRM,
    needs: { journeys: 'all', stages: 'all' },
    drives: {
      learning: 'Picks the courses and certifications for your function.',
      networking: 'Finds peers in your function in the community and among alumni.',
      opportunities: 'Sets the market data (pay, demand, who is hiring) we show you.',
    },
    opportunity: 'Courses for your function, peers to talk to, and a market read for your role.',
    readBy: ['src/lib/learning/build-learning-plan.ts', 'src/components/market/AdzunaMarketSection.tsx'],
  },
  {
    key: 'years',
    group: 'who',
    question: 'How many years of experience do you have?',
    field: 'yearsExperience',
    where: ONBOARDING_CONFIRM,
    needs: { journeys: 'all', stages: 'all' },
    drives: { report: 'Calibrates how your experience reads to a hiring manager.', coaching: 'Sets how direct and how senior the coaching is.' },
    opportunity: 'A fair read of where you stand, so roles that fit your experience rise to the top.',
    readBy: ['src/lib/jobs/analyze-job-fit.ts', 'src/lib/reports/market-reality-report.ts'],
  },

  // ── What you want ─────────────────────────────────────────────────────────
  {
    key: 'target_role',
    group: 'want',
    question: 'What role are you aiming for next?',
    field: 'targetRoleType',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: ALL_STAGES_BUT_LANDED },
    drives: {
      learning: 'The skills those roles ask for that your résumé does not show become your Learn list.',
      networking: 'People in that role, and alumni who have held it, become your suggested contacts.',
      opportunities: 'Sets the daily job list, the NC job board shortlist and which companies rank for you.',
      plan: 'Interview practice and pitch are written for this role.',
    },
    opportunity: 'Roles you can apply for today, the skills to close the gap, and the people who can introduce you.',
    readBy: ['src/lib/learning/build-learning-plan.ts', 'src/lib/network/job-discovery.ts', 'src/components/dashboard/interview-prep/PracticeTab.tsx'],
  },
  {
    key: 'target_function',
    group: 'want',
    question: 'Which function do you want to move into?',
    field: 'targetFunction',
    where: STRATEGY,
    needs: { journeys: ['CAREER_CHANGE'], stages: 'all' },
    drives: {
      learning: 'Bridge courses and credentials for the field you are moving into.',
      networking: 'Informational calls with people already working in that field.',
      opportunities: 'Roles in the new field that accept your transferable strengths.',
    },
    opportunity: 'Entry points into the new field, and the credentials that make the switch credible.',
    readBy: ['src/lib/jobs/job-fit-bucket.ts', 'src/lib/matching/candidate-role-matches.ts'],
  },
  {
    key: 'target_industries',
    group: 'want',
    question: 'Which industries do you want to work in?',
    field: 'targetIndustries',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: ALL_STAGES_BUT_LANDED },
    drives: {
      learning: 'Industry-specific courses and context.',
      networking: 'Industry groups and alumni in those industries.',
      opportunities: 'Ranks companies and roles in those industries first.',
    },
    opportunity: 'Companies in the industries you chose, ranked by how well they fit you.',
    readBy: ['src/lib/learning/build-learning-plan.ts', 'src/components/dashboard/DossierReportSections.tsx'],
  },
  {
    key: 'company_size',
    group: 'want',
    question: 'What size of company do you want?',
    field: 'targetCompanySize',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: READY },
    drives: { opportunities: 'Ranks companies by size fit and filters the job shortlist.', report: 'Explains how hard the search is for that size of company.' },
    opportunity: 'Companies of the size you want, ranked.',
    readBy: ['src/lib/companies/company-ranking.ts', 'src/lib/jobs/job-fit-bucket.ts'],
  },
  {
    key: 'company_stage',
    group: 'want',
    question: 'What stage of company do you want (startup, growth, enterprise, non-profit)?',
    field: 'targetCompanyStage',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: READY },
    drives: { opportunities: 'Tailors the interim and fractional marketplace and the company ranking.', report: 'Names the trade-offs of that kind of company.' },
    opportunity: 'Companies and interim roles at the stage you prefer.',
    readBy: ['src/lib/interim-work/marketplace-tailoring.ts', 'src/lib/search-strategy.ts'],
  },
  {
    key: 'comp_floor',
    group: 'want',
    question: 'What is the least you would take?',
    field: 'targetCompMin',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: READY },
    drives: {
      opportunities: 'Filters roles and shows how many advertised roles clear your floor.',
      plan: 'Offer-stage negotiation starts from your number.',
      report: 'Says how far your target sits above advertised pay.',
    },
    opportunity: 'Only roles that can pay what you need, and a plan to negotiate toward it.',
    readBy: ['src/components/market/AdzunaMarketSection.tsx', 'src/lib/matching/compute-match-score.ts'],
  },
  {
    key: 'deal_breakers',
    group: 'want',
    question: 'What are your deal breakers?',
    field: 'dealBreakers',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: READY },
    drives: { coaching: 'Your coach holds you to them when an offer tempts you.', report: 'The report and strategy guidance work around them.' },
    opportunity: 'Fewer wasted applications and interviews.',
    readBy: ['src/lib/search-strategy.ts', 'src/lib/reports/search-strategy-guidance.ts'],
  },
  {
    key: 'start_lower',
    group: 'want',
    question: 'Would you start lower to get in?',
    field: 'willingToStartLower',
    where: STRATEGY,
    needs: { journeys: ['LAID_OFF', 'CAREER_CHANGE', 'RETURNING', 'NEXT_ACT'], stages: READY },
    drives: { opportunities: 'Widens the shortlist to the step below your level.', coaching: 'Your coach is honest about trade-offs of starting lower.' },
    opportunity: 'More roles in a harder market, with a path back up.',
    readBy: ['src/lib/reports/search-strategy-guidance.ts', 'src/lib/scoring/dossier-competencies.ts'],
  },
  {
    key: 'relocation',
    group: 'want',
    question: 'Are you open to relocating?',
    field: 'openToRelocation',
    where: ONBOARDING_LOCATION,
    needs: { journeys: SEARCHING, stages: READY },
    drives: { opportunities: 'Opens the shortlist beyond your metro.', plan: 'Adds relocation steps (cost of living, timing) when you are interviewing elsewhere.' },
    opportunity: 'Roles and employers outside your city.',
    readBy: ['src/lib/matching/compute-match-score.ts', 'src/lib/jobs/analyze-job-fit.ts'],
  },
  {
    key: 'remote',
    group: 'want',
    question: 'Remote, hybrid or on-site?',
    field: 'remotePreference',
    where: ONBOARDING_LOCATION,
    needs: { journeys: SEARCHING, stages: READY },
    drives: { opportunities: 'Filters and ranks roles by where the work happens.', report: 'Explains how the market looks for your setup.' },
    opportunity: 'Roles that match how you want to work.',
    readBy: ['src/lib/matching/compute-match-score.ts', 'src/app/dashboard/market-reality/page.tsx'],
  },
  {
    key: 'tradeoffs',
    group: 'want',
    question: 'What matters most: pay, work-life, mission, brand, security?',
    field: 'priorityMaxComp',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: READY },
    drives: { opportunities: 'Ranks each role by what you said matters most.', coaching: 'Your coach weighs offers against your own ranking.' },
    opportunity: 'The role that fits what you care about, not just the highest pay.',
    readBy: ['src/lib/jobs/job-fit-bucket.ts', 'src/lib/matching/compute-match-score.ts'],
  },
  {
    key: 'culture_importance',
    group: 'want',
    question: 'How much do company culture and working environment matter to you?',
    field: 'cultureFit.importance',
    token: 'cultureFit',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: ALL_STAGES_BUT_LANDED },
    drives: {
      plan: 'If it matters: steps to learn what working somewhere is really like. If not, nothing is added.',
      coaching: 'Your coach brings it up when it matters, and leaves it alone when it does not.',
    },
    opportunity: 'Employers that fit how you like to work, and questions that show it before you accept.',
    readBy: ['src/lib/culture/culture-fit.ts', 'src/lib/coach/generate-reply.ts', 'src/lib/reports/market-reality-report.ts'],
  },
  {
    key: 'culture_details',
    group: 'want',
    question: 'What kind of culture and working environment do you want?',
    field: 'cultureFit.answers',
    token: 'cultureFit',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: ALL_STAGES_BUT_LANDED, when: cultureMatters },
    drives: {
      plan: 'Turns into questions to ask in interviews and checks on an offer.',
      networking: 'Points you to people who work at target companies to ask what it is really like.',
      opportunities: 'Colors the fit check on a role and the company notes we show.',
    },
    opportunity: 'A fit you can check before you say yes, from the people who work there.',
    readBy: ['src/lib/culture/culture-fit.ts', 'src/lib/jobs/analyze-job-fit.ts', 'src/lib/reports/search-strategy-guidance.ts'],
  },

  // ── How you work and want to be coached ───────────────────────────────────
  {
    key: 'pace',
    group: 'how',
    question: 'How actively are you looking?',
    field: 'searchIntensity',
    where: PRIVACY,
    needs: { journeys: SEARCHING, stages: ALL_STAGES_BUT_LANDED },
    drives: { plan: 'A light plan and half the point target if casual; the full plan if active.', coaching: 'Sets how hard we push and how often we email.' },
    opportunity: 'A search that fits your life, so you keep going.',
    readBy: ['src/lib/weekly/pace.ts', 'src/lib/coach/generate-reply.ts'],
  },
  {
    key: 'application_volume',
    group: 'how',
    question: 'How many applications a week is realistic for you?',
    field: 'applicationVolumeGoal',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: ['APPLYING', 'INTERVIEWING'] },
    drives: { plan: 'Sets the weekly application target and the daily "apply today" ask.' },
    opportunity: 'A target you can hit, so applications turn into interviews.',
    readBy: ['src/lib/daily/check-in-prompt.ts', 'src/lib/network/application-trends.ts'],
  },
  {
    key: 'network_comfort',
    group: 'how',
    question: 'How comfortable are you reaching out to people?',
    field: 'networkComfortLevel',
    where: { label: 'Onboarding: one more thing', href: '/onboarding/location' },
    needs: { journeys: 'all', stages: 'all' },
    drives: { networking: 'Chooses how many outreach steps, which scripts and how warm the first asks are.', coaching: 'Your coach starts where you are comfortable.' },
    opportunity: 'Introductions and conversations you would otherwise skip.',
    readBy: ['src/app/dashboard/network/page.tsx', 'src/lib/reports/search-strategy-guidance.ts'],
  },
  {
    key: 'coaching_style',
    group: 'how',
    question: 'When you are stuck, what kind of push works better: tough love, gentle, or a mix?',
    field: 'coachingStylePreference',
    where: { label: 'Onboarding: one more thing', href: '/onboarding/location' },
    needs: { journeys: 'all', stages: 'all' },
    drives: { coaching: 'Sets how direct feedback is.', plan: 'Sets the wording of unlock and stalled-search messages.' },
    opportunity: 'Feedback you will actually act on.',
    readBy: ['src/lib/coach/generate-reply.ts', 'src/lib/journey/engagement-data.ts'],
  },
  {
    key: 'change_readiness',
    group: 'how',
    question: 'How ready are you for change, and how fast do you like to move?',
    field: 'changeReadiness',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: ['EXPLORING', 'PREPARING'] },
    drives: { plan: 'Big leaps or baby steps in what we ask of you each week.', coaching: 'Frames guidance to your readiness.' },
    opportunity: 'A plan sized so you start.',
    readBy: ['src/lib/search-strategy.ts', 'src/lib/reports/search-strategy-guidance.ts'],
  },
  {
    key: 'blockers',
    group: 'how',
    question: 'What is getting in the way?',
    field: 'blockers',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: ['PREPARING', 'APPLYING', 'INTERVIEWING'] },
    drives: { plan: 'Puts the first step against your biggest blocker first.', coaching: 'Coaching notes name them.', learning: 'A skills gap blocker routes you to Learning.' },
    opportunity: 'The one fix that frees the rest of the search.',
    readBy: ['src/lib/coach/coaching-notes.ts', 'src/lib/scoring/market-reality/probability.ts'],
  },
  {
    key: 'motivations',
    group: 'how',
    question: 'What motivates you?',
    field: 'motivations',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: 'all' },
    drives: { coaching: 'Your coach uses what motivates you on a hard day.', report: 'The report speaks to what you care about.' },
    opportunity: 'Encouragement that works for you.',
    readBy: ['src/lib/coach/coaching-notes.ts', 'src/app/dashboard/market-reality/page.tsx'],
  },

  // ── Your situation ────────────────────────────────────────────────────────
  {
    key: 'start_timing',
    group: 'situation',
    question: 'When do you want to start applying?',
    field: 'journeyDetails.applyTiming',
    where: ONBOARDING_LOCATION,
    needs: { journeys: ['EXPLORING_MOVE', 'PROMOTION', 'CAREER_CHANGE', 'NEXT_ACT'], stages: ['EXPLORING', 'PREPARING'] },
    drives: { plan: 'Sets your stage: applying now, preparing, or exploring.', coaching: 'Sets the pace of check-ins.' },
    opportunity: 'A plan that matches how soon you want to move.',
    readBy: ['src/app/onboarding/actions.ts', 'src/components/onboarding/LocationForm.tsx'],
  },
  {
    key: 'laid_off_timing',
    group: 'situation',
    question: 'Do you want to start right away, or take some time first?',
    field: 'journeyDetails.startTiming',
    where: ONBOARDING_LOCATION,
    needs: { journeys: ['LAID_OFF'], stages: ['EXPLORING', 'PREPARING', 'APPLYING'] },
    drives: { plan: 'Taking time first starts you in Preparing or Exploring, with severance and benefits first and no application targets.' },
    opportunity: 'A plan that respects the time you need, without losing the benefits deadlines.',
    readBy: ['src/app/onboarding/actions.ts', 'src/components/onboarding/LocationForm.tsx'],
  },
  {
    key: 'move_driver',
    group: 'situation',
    question: 'What is behind the move?',
    field: 'journeyDetails.moveDriver',
    token: 'moveDriverOf',
    where: PRIVACY,
    needs: { journeys: ['EXPLORING_MOVE'], stages: ['EXPLORING', 'PREPARING'] },
    drives: { plan: 'Worry about a layoff puts runway and benefits first.', report: 'Frames the report for your reason.' },
    opportunity: 'The right first step for your reason.',
    readBy: ['src/lib/weekly/sprint.ts', 'src/lib/reports/market-reality-report.ts'],
  },
  {
    key: 'gap',
    group: 'situation',
    question: 'How long have you been out of work or searching?',
    field: 'gapDuration',
    where: ONBOARDING_LOCATION,
    needs: { journeys: ['LAID_OFF', 'RETURNING', 'STUDENT_NEW_GRAD'], stages: READY },
    drives: { report: 'Names the gap as context and how hard the search is at that length.', coaching: 'Sets how directly your coach talks about time.' },
    opportunity: 'A search plan sized to how long it has been.',
    readBy: ['src/lib/search-strategy.ts', 'src/lib/scoring/named-reasons.ts'],
  },
  {
    key: 'return_date',
    group: 'situation',
    question: 'When do you expect to be back?',
    field: 'journeyDetails.returnDate',
    where: PRIVACY,
    needs: { journeys: ['TIME_OFF'], stages: 'all' },
    drives: { plan: 'Counts down to your return with small steps.', coaching: 'We ask how you are doing as the date nears.' },
    opportunity: 'A return on your terms, with your skills and relationships warm.',
    readBy: ['src/lib/journey/journey.ts', 'src/lib/journey/engagement.ts'],
  },
  {
    key: 'current_pay',
    group: 'situation',
    question: 'What do you earn now?',
    field: 'lastSalary',
    where: { label: 'My Profile', href: '/dashboard/profile/personal' },
    needs: { journeys: ['GROWING', 'PROMOTION', 'EXPLORING_MOVE', 'ENTREPRENEUR'], stages: 'all' },
    drives: { plan: 'Pay benchmarks and the ask for a raise or promotion.', report: 'Shows where your pay sits.' },
    opportunity: 'The case for a raise, or the number to beat in a move.',
    readBy: ['src/components/market/PayPosition.tsx', 'src/lib/jobs/generate-negotiation-advice.ts'],
  },
  {
    key: 'offering',
    group: 'situation',
    question: 'In one line, who do you help and what result do you deliver?',
    field: 'journeyDetails.offering',
    where: PRIVACY,
    needs: { journeys: ['FRACTIONAL'], stages: 'all' },
    drives: { plan: 'Becomes the line in your outreach, your profile and your posts.', networking: 'The line you use when you ask for a referral.' },
    opportunity: 'Clear positioning, so the right clients recognize themselves.',
    readBy: ['src/lib/journey/engagement.ts'],
  },
  {
    key: 'capacity',
    group: 'situation',
    question: 'How many days a week are open for new work?',
    field: 'journeyDetails.openDays',
    where: PRIVACY,
    needs: { journeys: ['FRACTIONAL'], stages: 'all' },
    drives: { plan: 'Open days get a pipeline step; a full week does not.', opportunities: 'Interim and fractional listings are worth your attention only when you have room.' },
    opportunity: 'New engagements when you have room, and a break when you do not.',
    readBy: ['src/lib/journey/engagement.ts'],
  },
  {
    key: 'engagement_end',
    group: 'situation',
    question: 'When does your current engagement end?',
    field: 'journeyDetails.engagementEnds',
    where: PRIVACY,
    needs: { journeys: ['FRACTIONAL'], stages: 'all' },
    drives: { plan: 'Starts the renewal or replacement conversation 30 to 45 days before it ends.', networking: 'Prompts a reference or referral ask while the work is fresh.' },
    opportunity: 'No gap between engagements.',
    readBy: ['src/lib/journey/engagement.ts'],
  },

  {
    key: 'relocation_scope',
    group: 'want',
    question: 'How far would you go for the right role: stay local, a wider area, particular states or anywhere?',
    field: 'journeyDetails.relocation',
    token: 'relocation',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: READY },
    drives: {
      opportunities: 'Roles in the states you pick rank as a move you would make; the rest rank as out of reach.',
      plan: 'A search that has run six weeks widens to the places you named.',
    },
    opportunity: 'Roles in the places you would actually go, and a wider net when the local market is thin.',
    readBy: ['src/lib/jobs/job-match.ts', 'src/lib/journey/engagement.ts'],
  },
  {
    key: 'open_functions',
    group: 'want',
    question: 'Are you open to work in other fields, and if the change is big, what will you do to get there?',
    field: 'journeyDetails.pivot',
    token: 'pivot',
    where: STRATEGY,
    needs: { journeys: SEARCHING, stages: ['EXPLORING', 'PREPARING', 'APPLYING', 'INTERVIEWING'] },
    drives: {
      plan: 'A committed change puts a weekly learning block in your plan; a natural move adds a conversation.',
      opportunities: 'Roles in a new function are searched once the move is realistic or you have committed to the training.',
      learning: 'Courses and certificates for the field you committed to, informal or formal.',
      coaching: 'Your coach hears the route and the hours you promised.',
    },
    opportunity: 'A realistic path into a new field, with the training and a date, instead of roles you cannot yet win.',
    readBy: ['src/lib/journey/pivot.ts', 'src/lib/journey/engagement.ts'],
  },
  {
    key: 'career_focus',
    group: 'want',
    question: 'What matters most right now: better pay, the next level, or both?',
    field: 'journeyDetails.career',
    token: 'career',
    where: STRATEGY,
    needs: { journeys: ['GROWING', 'PROMOTION'], stages: 'all' },
    drives: {
      plan: 'Pay benchmark, the gap to your next level, your review date and the skill you want to build.',
      learning: 'The skill you chose to build gets a weekly step.',
    },
    opportunity: 'A case for a raise or promotion with a date on it, or the number to beat in a move.',
    readBy: ['src/lib/journey/career.ts', 'src/lib/journey/engagement.ts'],
  },
  {
    key: 'red_flags',
    group: 'situation',
    question: 'Do any of these apply: a non-compete, a past firing for cause, or a drug test or background check you would not take?',
    field: 'hasRestrictiveCovenant',
    where: { label: 'Screening questions', href: '/dashboard/profile/screening' },
    needs: { journeys: SEARCHING, stages: READY },
    drives: { plan: 'Steps to read a non-compete, practise an honest answer, and check which roles require a test or check. Private to you.' },
    opportunity: 'No surprise late in an offer, and a short list of roles you are eligible for.',
    readBy: ['src/lib/journey/engagement-data.ts'],
  },
  {
    key: 'situation_facts',
    group: 'situation',
    question: 'What dates and numbers shape your situation, such as when severance or coverage ends, your day rate or your runway?',
    field: 'journeyDetails',
    token: 'situationPlanItems',
    where: PRIVACY,
    needs: { journeys: ['LAID_OFF', 'EXPLORING_MOVE', 'RETURNING', 'NEXT_ACT', 'GROWING', 'FRACTIONAL', 'ENTREPRENEUR', 'TIME_OFF'], stages: 'all' },
    drives: { plan: 'Deadlines, rates and runway become dated steps in your plan.' },
    opportunity: 'The right step before a deadline, not after it.',
    readBy: ['src/lib/journey/situation.ts', 'src/lib/journey/engagement.ts'],
  },

  {
    key: 'track_record',
    group: 'proof',
    question: 'How big were the teams, budgets and scope you have owned, and which functions have you run outside your own?',
    field: 'trackRecordResponse',
    where: { label: 'Track Record', href: '/dashboard/track-record' },
    needs: { journeys: 'all', stages: 'all' },
    drives: {
      report: 'Strengths and the Dossier read the size of what you have led.',
      plan: 'Your case for a review, raise or promotion, and a head start when you move into a function you have already run.',
      opportunities: 'A function you have owned counts as a natural move, not a rebuild.',
    },
    opportunity: 'Roles that match the scope you have really carried, and a faster route into fields you have already touched.',
    readBy: ['src/lib/profile/strengths-load.ts', 'src/lib/profile/work-profile-load.ts', 'src/lib/journey/engagement-data.ts'],
  },
  {
    key: 'what_i_need',
    group: 'how',
    question: 'What do you need from work: independence, support, recognition, working conditions?',
    field: 'whatINeedResponse',
    where: { label: 'What I Need', href: '/dashboard/what-i-need' },
    needs: { journeys: SEARCHING, stages: ALL_STAGES_BUT_LANDED },
    drives: { opportunities: 'Job fit adds or subtracts for how a role matches what you need.', coaching: 'Your coach hears what you need from your next job.' },
    opportunity: 'Roles and companies that fit how you want to work, not only what you can do.',
    readBy: ['src/lib/profile/work-profile-load.ts', 'src/lib/profile/people-like-you.ts'],
  },
  {
    key: 'work_interests',
    group: 'want',
    question: 'Which kinds of work interest you most?',
    field: 'interestAreas',
    where: { label: 'Work Interests', href: '/dashboard/work-interests' },
    needs: { journeys: SEARCHING, stages: ALL_STAGES_BUT_LANDED },
    drives: { opportunities: 'Roles in the areas you like rank higher.' },
    opportunity: 'A shortlist that leans toward the work you would enjoy.',
    readBy: ['src/lib/jobs/job-fit-bucket.ts'],
  },
  {
    key: 'coaching_form',
    group: 'how',
    question: 'What are your non-negotiables and your biggest worry about this search?',
    field: 'nonNegotiables',
    where: { label: 'Coaching form', href: '/dashboard/coaching-form' },
    needs: { journeys: 'all', stages: 'all' },
    drives: { coaching: 'Your coach starts each session from what you cannot give up and what worries you most.' },
    opportunity: 'Coaching that starts where you are, not with questions you already answered.',
    readBy: ['src/lib/coach/pre-session-brief.ts'],
  },

  // ── What you can show ─────────────────────────────────────────────────────
  {
    key: 'skills_assessment',
    group: 'proof',
    question: 'What skills do you have, and which do you want to build?',
    field: 'skillsAssessmentCompletedAt',
    where: { label: 'Skills & Behavioral Assessments', href: '/dashboard/skills-assessments' },
    needs: { journeys: [...SEARCHING, 'GROWING', 'FRACTIONAL'], stages: 'all' },
    drives: { learning: 'Unlocks Learning and Videos and builds your learning plan.', opportunities: 'Improves job matches and the daily list.' },
    opportunity: 'Courses and roles that fit the skills you have and the ones you are building.',
    readBy: ['src/app/dashboard/learning/page.tsx', 'src/lib/job-search-daily/build.ts'],
  },
] as const

// ── Reading a profile ───────────────────────────────────────────────────────

export function get(p: ProfileLike, path: string): unknown {
  let cur: unknown = p
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

export function isSet(p: ProfileLike, field: string): boolean {
  const v = get(p, field)
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}

function matches(list: readonly string[] | 'all', value: string | null): boolean {
  return list === 'all' || (value !== null && list.includes(value))
}

// The signals this journey and stage need, in the order we ask them.
export function spineFor(journey: JourneyType | null, stage: JourneyStage | null, p: ProfileLike = {}): Signal[] {
  return SIGNALS.filter((s) => matches(s.needs.journeys, journey) && matches(s.needs.stages, stage) && (!s.needs.when || s.needs.when(p)))
}

export type SpineGap = { key: string; label: string; why: string; unlocks: string; href: string }

// What is still missing from the spine for this member, most useful first (the
// order of SIGNALS). `why` is what the answer drives; `unlocks` is the opportunity.
export function spineGaps(journey: JourneyType | null, stage: JourneyStage | null, p: ProfileLike): SpineGap[] {
  return spineFor(journey, stage, p)
    .filter((s) => !isSet(p, s.field))
    .map((s) => {
      const why = s.drives.plan ?? s.drives.learning ?? s.drives.networking ?? s.drives.opportunities ?? s.drives.report ?? s.drives.coaching ?? ''
      return { key: s.key, label: s.question, why, unlocks: s.opportunity, href: s.where.href }
    })
}

export function spineProgress(journey: JourneyType | null, stage: JourneyStage | null, p: ProfileLike): { done: number; total: number } {
  const needed = spineFor(journey, stage, p)
  return { done: needed.filter((s) => isSet(p, s.field)).length, total: needed.length }
}

export { NOT_SEARCHING, SEARCHING }
