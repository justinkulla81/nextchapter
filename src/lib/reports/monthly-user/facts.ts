// One row per member, holding only what the monthly report needs. The loader
// (load.ts) fills these from the database; the builder (build.ts) turns them
// into the report. Splitting the two keeps every number testable without a
// database. Nothing here is free text a member typed.

export interface ApplicationFact {
  channel: string | null
  company: string | null
  createdAt: Date
  appliedAt: Date | null
  interviewAt: Date | null
  offerAt: Date | null
  declinedAt: Date | null
}

export interface CoachSessionFact {
  at: Date
  type: string
  durationMinutes: number | null
  rating: number | null
  /** Statuses (ON_TRACK / AT_RISK / STALLED) a coach recorded for each search dimension. */
  dimensions: Record<string, string | null>
}

export interface ContactFact {
  at: Date
  warmth: string
  source: string
  category: string | null
}

export interface MemberFacts {
  id: string
  registeredAt: Date

  // Who they are
  seniority: string | null
  yearsExperience: number | null
  education: string | null
  schools: string[]
  fieldsOfStudy: string[]
  ageBand: string | null
  state: string | null
  country: string | null
  metro: string | null
  fn: string | null
  industry: string | null
  currentEmployers: string[]
  formerEmployers: string[]
  jobStatus: string | null
  journey: string | null
  leadSource: string | null
  trajectory: string | null
  isPivoting: boolean

  // What they want
  targetRoleType: string | null
  targetFunction: string | null
  targetIndustries: string[]
  remotePreference: string | null
  openToRelocation: boolean
  willingToStartLower: boolean
  interimInterest: boolean
  targetCompanySize: string | null
  targetCompanyStage: string | null
  targetCompMin: number | null
  applicationVolumeGoal: number | null
  outreachTargetPerWeek: number | null
  searchIntensity: string | null
  searchIntensityScore: number | null
  changeReadiness: string | null
  gapDuration: string | null
  confidential: boolean
  motivations: string[]
  blockers: string[]
  barriers: string[]
  networkingConcerns: string[]
  connectPreferences: string[]
  strengths: string[]
  growthAreas: string[]
  skillsToBuild: string[]

  // How they like to work
  coachingStylePreference: string | null
  changePace: string | null
  topCoachingStyles: string[]
  notificationTier: string | null
  networkComfort: string | null
  disclosureComfort: string | null
  networkingLevel: number | null
  storyComfort: number | null
  interviewComfort: number | null
  pitchReady: number | null
  negotiationComfort: number | null
  hasCoach: boolean

  // Where they are in the product
  resumeUploaded: boolean
  resumeStepComplete: boolean
  assessmentComplete: boolean
  contractAccepted: boolean
  trackRecordDone: boolean
  whatINeedDone: boolean
  skillsAssessmentDone: boolean
  strategyConfirmed: boolean
  referencesRequested: number
  referencesCompleted: number
  recruiterOptIn: boolean
  resumeBookOptIn: boolean
  leaderboardOptIn: boolean
  grade: string | null
  composite: number | null
  components: { experience: number | null; resume: number | null; evidence: number | null; effort: number | null; market: number | null }
  currentStreak: number
  membershipPlan: string | null
  membershipStatus: string | null
  contactsTotal: number

  // Dated events, limited to the report month and the month before it.
  logins: Date[]
  applications: ApplicationFact[]
  outreach: Array<{ at: Date; channel: string }>
  linkedinPosts: Date[]
  communityPosts: Date[]
  checkIns: Array<{ at: Date; mood: string }>
  sprintWeeks: Date[]
  courses: Array<{ at: Date; status: string }>
  coachSessions: CoachSessionFact[]
  contactsAdded: ContactFact[]
  referenceRequests: Date[]
  referenceCompletions: Date[]
  hires: Date[]
  recruiterIntros: Date[]
  recruiterSubmissions: Date[]
  recruiterPlacements: Date[]
  /** Weekly Market Reality grades inside the month window: first and last seen. */
  gradeFirst: string | null
  gradeLast: string | null
}

export interface ReportInput {
  members: MemberFacts[]
  /** Coaching-waitlist sign-ups in the month (not tied to a member). */
  waitlistSignups: number
  waitlistSignupsPrior: number
}
