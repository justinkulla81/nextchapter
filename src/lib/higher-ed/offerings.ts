// The services an institution can offer through its portal: one catalog,
// switched on per institution in Institution.enabledFeatures.offerings.
// Data-driven like WORKSPACES: adding a service is an entry here.
//
// availability:
//   'included' — part of the V1 platform (some screens still land in later
//                HE steps; buildStep says which)
//   'add-on'   — V1, priced separately (Stripe checkout lands in HE-14)
//   'v2'       — needs programs/cohorts (spec §13); turning it on puts it
//                on the institution's plan, not live for members yet

export type OfferingCategory = 'career' | 'programs' | 'campaigns' | 'employer' | 'data'
export type OfferingAvailability = 'included' | 'add-on' | 'v2'

export type Offering = {
  key: string
  category: OfferingCategory
  name: string
  description: string
  audience: string
  availability: OfferingAvailability
  buildStep?: string
  defaultOn: boolean
  // Shown on the member's Candidate home when on.
  memberFacing: boolean
  // Real programs elsewhere, for the sales conversation (public, linked).
  examples?: { name: string; institution: string; url: string }[]
}

export const OFFERING_CATEGORIES: { key: OfferingCategory; label: string; blurb: string }[] = [
  { key: 'career', label: 'Career services', blurb: 'One-to-one help for alumni and students, on top of the full NextChapter toolkit.' },
  { key: 'programs', label: 'Programs and upskilling', blurb: 'Cohort programs your faculty or partners teach. Arrives with V2 programs and enrollment.' },
  { key: 'campaigns', label: 'Campaigns', blurb: 'Outreach that runs on a schedule or a trigger, sent from your college.' },
  { key: 'employer', label: 'Employer and partner services', blurb: 'Bring hiring alumni, local employers and the workforce system in.' },
  { key: 'data', label: 'Data services', blurb: 'What flows back to Advancement and leadership.' },
]

export const OFFERINGS: Offering[] = [
  // Career services
  { key: 'toolkit', category: 'career', name: 'NextChapter job-search toolkit', description: 'Market Reality Grade, Search Action Plan, Weekly Search Sprint, Dossier and Support Network for every member.', audience: 'Alumni and students', availability: 'included', defaultOn: true, memberFacing: true },
  { key: 'coaching', category: 'career', name: 'One-to-one career coaching', description: 'Premium coaching packages; Resilience Fund awards appear to the member as prepaid.', audience: 'Alumni', availability: 'add-on', buildStep: 'HE-14', defaultOn: true, memberFacing: true },
  { key: 'mentors', category: 'career', name: 'Alumni mentor network', description: 'Alumni volunteer by industry and function; members request a call.', audience: 'Alumni and students', availability: 'included', buildStep: 'HE-09', defaultOn: true, memberFacing: true },
  { key: 'layoff_response', category: 'career', name: 'Layoff rapid response', description: 'When a WARN notice hits an alum’s employer, Alumni Relations reaches out within days with coaching and the toolkit.', audience: 'Alumni', availability: 'included', buildStep: 'HE-08', defaultOn: true, memberFacing: false },
  { key: 'new_grad_launch', category: 'career', name: 'New-grad launch kit', description: 'First-job search, offer review and salary negotiation for the last two classes.', audience: 'Recent grads', availability: 'included', buildStep: 'HE-11', defaultOn: true, memberFacing: true },
  { key: 'resume_reviews', category: 'career', name: 'Resume, LinkedIn and mock interviews', description: 'Reviewed by Career Services counselors from the caseload view.', audience: 'Alumni and students', availability: 'included', buildStep: 'HE-11', defaultOn: false, memberFacing: true },
  { key: 'negotiation_clinic', category: 'career', name: 'Salary negotiation clinics', description: 'Monthly group sessions, with offer-specific talking points from the toolkit.', audience: 'Alumni', availability: 'add-on', defaultOn: false, memberFacing: true },
  { key: 'spouse_seats', category: 'career', name: 'Spouse and partner seats', description: 'A member’s spouse or partner gets their own seat.', audience: 'Alumni families', availability: 'add-on', buildStep: 'HE-14', defaultOn: false, memberFacing: true },
  { key: 'resilience_fund', category: 'career', name: 'Resilience Fund', description: 'Donors fund coaching and premium seats for alumni between jobs; Development reports on every dollar.', audience: 'Alumni in transition', availability: 'included', buildStep: 'HE-10', defaultOn: true, memberFacing: false },

  // Programs (V2)
  { key: 'ai_professionals', category: 'programs', name: 'AI for working professionals', description: 'Six-week cohort: practical generative AI, prompt design and automating the repetitive parts of operations, finance and HR work.', audience: 'Mid-career alumni', availability: 'v2', defaultOn: false, memberFacing: false,
    examples: [
      { name: 'GenAI 101 (free, self-paced, opened to alumni first)', institution: 'Indiana University Kelley School of Business', url: 'https://blog.kelley.iu.edu/2026/04/16/iu-opens-free-generative-ai-course-to-anyone-worldwide-class-presented-by-kelley-school/' },
      { name: 'Free AI microcredential and Google Career Certificates for alumni', institution: 'Purdue University', url: 'https://www.purdue.edu/newsroom/purduetoday/2025/Q4/purdue-expands-free-online-ai-and-high-demand-technical-skill-courses-to-alumni/' },
      { name: 'Upskill: AI Track (one-week intensive run by Career Education)', institution: 'Wellesley College', url: 'https://www.wellesley.edu/academics/ai-and-the-liberal-arts' },
    ] },
  { key: 'ai_leaders', category: 'programs', name: 'Leading teams through AI adoption', description: 'For managers and executives: choosing use cases, redesigning roles, governance and change management.', audience: 'Senior alumni', availability: 'v2', defaultOn: false, memberFacing: false,
    examples: [{ name: 'Artificial Intelligence executive education (10 weeks, online)', institution: 'Carnegie Mellon School of Computer Science', url: 'https://execonline.cs.cmu.edu/introduction-artificial-intelligence' }] },
  { key: 'data_analytics', category: 'programs', name: 'Data analytics certificate', description: 'SQL, spreadsheets and dashboards, with a capstone built on a local employer’s real data.', audience: 'Alumni and adult learners', availability: 'v2', defaultOn: false, memberFacing: false },
  { key: 'project_management', category: 'programs', name: 'Project management (PMP prep)', description: 'Exam prep plus agile practice; pairs with employer capstones.', audience: 'Alumni and adult learners', availability: 'v2', defaultOn: false, memberFacing: false },
  { key: 'regional_reskilling', category: 'programs', name: 'Regional industry reskilling', description: 'Short programs aimed at the region’s largest employers (for example healthcare administration and energy), built with the local workforce board.', audience: 'Displaced workers and alumni', availability: 'v2', defaultOn: false, memberFacing: false },
  { key: 'return_to_work', category: 'programs', name: 'Return-to-work program', description: 'For alumni returning after caregiving or a long gap: skills refresh, Dossier and employer introductions.', audience: 'Alumni', availability: 'v2', defaultOn: false, memberFacing: false },
  { key: 'board_readiness', category: 'programs', name: 'Board-readiness series', description: 'Governance and nonprofit-board preparation for senior alumni, with board placement introductions.', audience: 'Senior alumni', availability: 'v2', defaultOn: false, memberFacing: false },
  { key: 'exec_ed', category: 'programs', name: 'Faculty-led executive education', description: 'Short courses taught by your faculty, open to alumni and local employers.', audience: 'Alumni and employers', availability: 'v2', defaultOn: false, memberFacing: false },

  // Campaigns
  { key: 'annual_checkin', category: 'campaigns', name: 'Annual career check-in', description: 'Once a year, every alum gets a two-question check-in: "How’s work?" and "Want help?" A "looking" answer opens support quietly.', audience: 'All alumni', availability: 'included', buildStep: 'HE-11', defaultOn: true, memberFacing: false },
  { key: 'grad_checkins', category: 'campaigns', name: 'New-grad check-ins (6, 18, 24 months)', description: 'Automatic check-ins after graduation; a "looking" answer alerts the counselor.', audience: 'Recent grads', availability: 'included', buildStep: 'HE-11', defaultOn: true, memberFacing: false },
  { key: 'layoff_outreach', category: 'campaigns', name: 'Layoff outreach', description: '"If you’re affected, we have your back." Sent when a WARN notice matches an alum’s employer.', audience: 'Affected alumni', availability: 'included', buildStep: 'HE-08', defaultOn: true, memberFacing: false },
  { key: 'gratitude', category: 'campaigns', name: 'Gratitude and Giving Day asks', description: 'After grace ends for an alum the college helped, Development approves a thank-you with the giving link.', audience: 'Placed alumni', availability: 'included', buildStep: 'HE-10', defaultOn: true, memberFacing: false },
  { key: 'mentor_drive', category: 'campaigns', name: 'Mentor recruitment drive', description: 'An annual ask to alumni in high-demand fields to mentor one person a month.', audience: 'Alumni', availability: 'included', buildStep: 'HE-09', defaultOn: false, memberFacing: false },
  { key: 'reunion_career', category: 'campaigns', name: 'Reunion-year career events', description: 'Career sessions and introductions for classes celebrating a reunion.', audience: 'Reunion classes', availability: 'included', buildStep: 'HE-08', defaultOn: false, memberFacing: false },

  // Employer and partner services
  { key: 'employer_packages', category: 'employer', name: 'Featured employer packages', description: 'Alumni-led and local employers post roles visible only to your members; Featured pins to the top.', audience: 'Employers', availability: 'add-on', buildStep: 'HE-13', defaultOn: true, memberFacing: true },
  { key: 'internship_pipeline', category: 'employer', name: 'Internship pipeline', description: 'Employers post internships for current students; Career Services approves them.', audience: 'Students and employers', availability: 'included', buildStep: 'HE-13', defaultOn: false, memberFacing: true },
  { key: 'hiring_alumni_drive', category: 'employer', name: '"Hire a fellow alum" drive', description: 'Ask alumni who hire to post roles and review shared Dossiers.', audience: 'Alumni who hire', availability: 'included', buildStep: 'HE-13', defaultOn: false, memberFacing: false },
  { key: 'sponsored_seats', category: 'employer', name: 'Employer-sponsored seats', description: 'A local employer funds seats or retraining for workers it is laying off.', audience: 'Employers', availability: 'v2', defaultOn: false, memberFacing: false },
  { key: 'workforce_board_partnership', category: 'employer', name: 'Workforce board partnership', description: 'Co-host job fairs with the local American Job Center and refer WIOA-eligible alumni for training funds.', audience: 'Alumni in transition', availability: 'v2', defaultOn: false, memberFacing: false },

  // Data services
  { key: 'crm_exchange', category: 'data', name: 'CRM exchange', description: 'Roster and gifts in, updates out (employer, title, in-transition, do-not-solicit, prospect flags) by CSV.', audience: 'Advancement', availability: 'included', buildStep: 'HE-05', defaultOn: true, memberFacing: false },
  { key: 'engagement_scoring', category: 'data', name: 'Engagement scoring', description: 'A CASE-aligned engagement score per member, as Low, Medium or High.', audience: 'Alumni Relations', availability: 'included', buildStep: 'HE-07', defaultOn: true, memberFacing: false },
  { key: 'roi_report', category: 'data', name: 'ROI and donor report', description: 'Giving lift for platform users versus matched non-users, plus a Resilience Fund donor report.', audience: 'Development and the board', availability: 'included', buildStep: 'HE-10', defaultOn: true, memberFacing: false },
]

export type OfferingState = Record<string, boolean>

export type CheckInSettings = { annualMonth: number }

export function offeringStateFrom(enabledFeatures: unknown): OfferingState {
  const stored = ((enabledFeatures as { offerings?: OfferingState } | null)?.offerings ?? {}) as OfferingState
  return Object.fromEntries(OFFERINGS.map((o) => [o.key, stored[o.key] ?? o.defaultOn]))
}

export function checkInSettingsFrom(enabledFeatures: unknown): CheckInSettings {
  const month = (enabledFeatures as { checkIns?: Partial<CheckInSettings> } | null)?.checkIns?.annualMonth
  return { annualMonth: month && month >= 1 && month <= 12 ? month : 9 }
}

export function getOffering(key: string): Offering | undefined {
  return OFFERINGS.find((o) => o.key === key)
}
