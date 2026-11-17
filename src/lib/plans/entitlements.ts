// What an institution's plan includes. Pure (no database, no server-only), so
// pages, actions, routes and tests all read the same answer.
//
// Two plans. PAID is every institution that existed before plans (the column
// defaults to 'PAID', so nothing already set up loses anything) and anyone
// NextChapter staff switch on. FREE is a verified, claimed workspace (owner
// decisions 2026-11-17): members are always free and anyone can join, but
// staff see only the first FREE_VISIBLE_MEMBERS of them (the rest show as a
// count; src/lib/plans/visible-members.ts); one administrator; unlimited member
// companies and invites; basic counts, its own services and its page.
//
// The plan is an extra gate that only restricts FREE. The license tier still
// decides which workspaces open (src/lib/higher-ed/workspaces.ts); PAID
// behaves exactly as it did before this file existed. Outplacement is
// contract-based and is not touched here.

export type InstitutionPlan = 'FREE' | 'PAID'

// No limit on how many people join a free organization (owner decision 2026-11-17). Kept as a named value so older
// readers compile; null means no cap.
export const FREE_MEMBER_CAP: number | null = null
// How many of its members a free organization's staff can see.
export const FREE_VISIBLE_MEMBERS = 5
// How many administrators a free organization has.
export const FREE_ADMIN_LIMIT = 1
// How many grants a free organization sees in full; the rest are blurred.
export const FREE_VISIBLE_GRANTS = 2
// How many skills a free organization sees in full on Market › Skills gaps; the rest are a preview.
export const FREE_VISIBLE_SKILL_GAPS = 3

// Where a free organization asks for the paid plan: the support address the
// portal already shows (RegionScreen). There is no self-serve billing.
export const PLAN_CONTACT_EMAIL = 'support@launchyournextchapter.com'

export type EntitlementFeature = 'reporting' | 'exports' | 'crmExchange' | 'staffRoles' | 'auditLog' | 'sso' | 'nextchapterServices' | 'wioa' | 'members' | 'grants' | 'publicPage' | 'partnerViews' | 'skillsGaps'

export type Entitlements = {
  // Most members the organization can hold; null = no cap.
  memberCap: number | null
  // How many members its staff can see by name; null = all.
  visibleMembers: number | null
  // How many administrators it can have; null = no limit.
  adminLimit: number | null
  // How many grants it sees in full; null = all.
  visibleGrants: number | null
  // How many skills it sees in full on the skills-gaps table; null = all.
  visibleSkillRows: number | null
  reporting: boolean
  exports: boolean
  crmExchange: boolean
  staffRoles: boolean
  auditLog: boolean
  sso: boolean
  nextchapterServices: boolean
  wioa: boolean
  // Writing its own section on its public page (owner decision 2026-11-17).
  publicPage: boolean
  // Read-only views of the region's data for a college, employer or partner, by link.
  partnerViews: boolean
}

export const isInstitutionPlan = (v: unknown): v is InstitutionPlan => v === 'FREE' || v === 'PAID'

// Anything that is not exactly 'FREE' is PAID, so a missing or unexpected
// value never takes features away from an existing customer.
export function planOf(v: unknown): InstitutionPlan {
  return v === 'FREE' ? 'FREE' : 'PAID'
}

export function institutionEntitlements(input: { plan: string | null | undefined; tier?: string | null; enabledFeatures?: unknown }): Entitlements {
  // tier and enabledFeatures stay with the workspace gating (tierIncludes and
  // the wioa switch). Accepted so callers can pass one institution row; unused
  // here on purpose, so the plan can only restrict, never grant.
  if (planOf(input.plan) === 'PAID') {
    return { memberCap: null, visibleMembers: null, adminLimit: null, visibleGrants: null, visibleSkillRows: null, reporting: true, exports: true, crmExchange: true, staffRoles: true, auditLog: true, sso: true, nextchapterServices: true, wioa: true, publicPage: true, partnerViews: true }
  }
  return { memberCap: FREE_MEMBER_CAP, visibleMembers: FREE_VISIBLE_MEMBERS, adminLimit: FREE_ADMIN_LIMIT, visibleGrants: FREE_VISIBLE_GRANTS, visibleSkillRows: FREE_VISIBLE_SKILL_GAPS, reporting: false, exports: false, crmExchange: false, staffRoles: false, auditLog: false, sso: false, nextchapterServices: false, wioa: false, publicPage: false, partnerViews: false }
}

const WHAT: Record<EntitlementFeature, string> = {
  reporting: 'Reporting and outcomes are',
  exports: 'Exports are',
  crmExchange: 'The CRM exchange is',
  staffRoles: 'Staff roles beyond the administrator are',
  auditLog: 'The activity log is',
  sso: 'Single sign-on is',
  nextchapterServices: 'Using NextChapter’s coaching and courses is',
  wioa: 'Workforce (WIOA) reporting is',
  members: `Seeing more than ${FREE_VISIBLE_MEMBERS} of your members is`,
  grants: `Every grant that fits you, with a shortlist, is`,
  skillsGaps: `Every skill gap, with the retraining that closes it, is`,
  publicPage: 'Writing your own section on your public page is',
  partnerViews: 'Sharing a live view of your region’s data with a partner is',
}

export const LOCKED_TITLES: Record<EntitlementFeature, string> = {
  reporting: 'Reporting and outcomes',
  exports: 'Exports',
  crmExchange: 'CRM exchange',
  staffRoles: 'Staff roles',
  auditLog: 'Activity log',
  sso: 'Single sign-on',
  nextchapterServices: 'NextChapter coaching and courses',
  wioa: 'Workforce (WIOA) reporting',
  members: 'See all your members',
  grants: 'Every grant that fits you',
  skillsGaps: 'The full skills-gap picture',
  publicPage: 'Your public page',
  partnerViews: 'Partner views',
}

// Plain words: what is locked, and the one thing to do about it.
export function lockedReason(feature: EntitlementFeature): string {
  return `${WHAT[feature]} part of the paid plan. Ask us to switch your plan on at ${PLAN_CONTACT_EMAIL}.`
}

export function planChangeMailto(feature: EntitlementFeature, slug: string): string {
  return `mailto:${PLAN_CONTACT_EMAIL}?subject=${encodeURIComponent(`Switch on the paid plan for ${slug}`)}&body=${encodeURIComponent(`I would like ${LOCKED_TITLES[feature].toLowerCase()} for ${slug}.`)}`
}

// ── Member cap ───────────────────────────────────────────────────────────────

export type CapRoom = { allowed: boolean; cap: number | null; left: number | null; message: string | null }

// How many more members fit. `current` is the members already held; `adding`
// is what the action would add. A null cap (PAID) always fits.
export function capRoom(cap: number | null, current: number, adding: number): CapRoom {
  if (cap === null) return { allowed: true, cap, left: null, message: null }
  const left = Math.max(0, cap - current)
  if (current + adding <= cap) return { allowed: true, cap, left, message: null }
  return { allowed: false, cap, left, message: capMessage(cap, left, adding) }
}

export function capMessage(cap: number, left: number, adding: number): string {
  const room = left === 0 ? 'there is no room left' : left === 1 ? 'there is room for 1 more' : `there is room for ${left} more`
  return `The free plan holds up to ${cap} members and ${room}, but this would add ${adding}. Remove some rows to fit, or ask us to switch on the paid plan at ${PLAN_CONTACT_EMAIL}.`
}

// Invitations: nobody is added, so the message says who is left waiting.
export function inviteCapMessage(cap: number, waiting: number): string {
  const rest = waiting > 0 ? ` ${waiting} ${waiting === 1 ? 'person is' : 'people are'} still waiting for an invitation.` : ''
  return `The free plan holds up to ${cap} members, and all ${cap} places are used.${rest} To invite more, ask us to switch on the paid plan at ${PLAN_CONTACT_EMAIL}.`
}

// The screens a FREE organization sees locked, keyed "workspace:tab".
export const GATED_SCREENS: Record<string, EntitlementFeature> = {
  'development:home': 'reporting',
  'career:outcomes': 'reporting',
  'alumni:data': 'reporting',
  'admin:board': 'reporting',
  'development:crm': 'crmExchange',
  'admin:activity': 'auditLog',
  'workforce:home': 'wioa',
  'workforce:etpl': 'wioa',
  'admin:publicpage': 'publicPage',
}

// Export kind -> the feature it needs. my-data and member-data are privacy
// rights (an alum's own record, FERPA requests) and are never plan-gated.
export const GATED_EXPORTS: Record<string, EntitlementFeature> = {
  updates: 'crmExchange',
  suppression: 'crmExchange',
  etpl: 'exports',
  wioa: 'wioa',
}

export function featureOn(e: Entitlements, feature: EntitlementFeature): boolean {
  if (feature === 'members') return e.visibleMembers === null
  if (feature === 'grants') return e.visibleGrants === null
  if (feature === 'skillsGaps') return e.visibleSkillRows === null
  return e[feature]
}

// The feature that blocks this export kind on this plan, or null when it may be downloaded.
export function blockedExport(kind: string, plan: string | null | undefined): EntitlementFeature | null {
  const feature = GATED_EXPORTS[kind]
  return feature && !featureOn(institutionEntitlements({ plan }), feature) ? feature : null
}

// The feature that locks this screen ("workspace:tab") on this plan, or null.
export function blockedScreen(screenKey: string, plan: string | null | undefined): EntitlementFeature | null {
  const feature = GATED_SCREENS[screenKey]
  return feature && !featureOn(institutionEntitlements({ plan }), feature) ? feature : null
}


// ── Free trial ───────────────────────────────────────────────────────────────

// One 30-day trial of everything the paid plan includes, started by the organization's own administrator, once. It is a
// date on the institution: while it runs the plan reads as PAID everywhere (resolve.ts), and when it ends the plan is FREE
// again with nothing deleted. NextChapter bills nothing; after the trial, the paid plan is switched on by staff.
export const TRIAL_DAYS = 30
const DAY = 86_400_000

export type TrialState = { state: 'none' | 'available' | 'active' | 'ended'; daysLeft: number | null; endsAt: Date | null }

/** `plan` is the stored plan. 'none' = already paid, nothing to trial. */
export function trialState(plan: string | null | undefined, trialStartedAt: Date | null | undefined, trialEndsAt: Date | null | undefined, now: Date = new Date()): TrialState {
  if (planOf(plan) === 'PAID') return { state: 'none', daysLeft: null, endsAt: null }
  if (!trialStartedAt || !trialEndsAt) return { state: 'available', daysLeft: null, endsAt: null }
  if (trialEndsAt.getTime() > now.getTime()) return { state: 'active', daysLeft: Math.max(1, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY)), endsAt: trialEndsAt }
  return { state: 'ended', daysLeft: 0, endsAt: trialEndsAt }
}

/** The plan to act on: a FREE organization inside its trial is PAID. */
export function effectivePlan(plan: string | null | undefined, trialEndsAt: Date | null | undefined, now: Date = new Date()): InstitutionPlan {
  if (planOf(plan) === 'PAID') return 'PAID'
  return trialEndsAt && trialEndsAt.getTime() > now.getTime() ? 'PAID' : 'FREE'
}

export const trialEndDate = (now: Date = new Date()) => new Date(now.getTime() + TRIAL_DAYS * DAY)

// ── What a locked screen shows ───────────────────────────────────────────────

// Locked is a preview, not a wall: what you would get, in the organization's own terms, with a sample of the real thing and
// one button. `sample` rows are illustrative, labelled as such on screen.
export type LockPitch = { headline: string; bullets: string[]; sampleTitle: string; sample: string[][] }

export const LOCK_PITCH: Record<EntitlementFeature, LockPitch> = {
  reporting: {
    headline: 'Show funders what happened, in one page',
    bullets: ['Seats offered, signed up, joined and landed, by layoff and by funding source', 'Print it or save it as a PDF for the board', 'People are never named; small groups are hidden'],
    sampleTitle: 'Outcomes report (sample)',
    sample: [['Seats offered', '180'], ['Signed up', '140'], ['Landed new roles', '32']],
  },
  exports: {
    headline: 'Take your data with you',
    bullets: ['Download the lists your funders and auditors ask for', 'Always current, never retyped', 'Counts and rows exactly as on screen'],
    sampleTitle: 'Export (sample)',
    sample: [['Participants', '1 file'], ['Programs', '1 file'], ['Outcomes', '1 file']],
  },
  crmExchange: {
    headline: 'Keep your CRM and NextChapter in step',
    bullets: ['Send updates out and bring suppression lists in', 'No double entry for your advancement team', 'Every exchange is logged'],
    sampleTitle: 'Exchange log (sample)',
    sample: [['Updates sent', 'Nov 16'], ['Suppression list in', 'Nov 12']],
  },
  staffRoles: {
    headline: 'Give each colleague the right access',
    bullets: ['Staff roles beyond the administrator', 'Each person sees only what they need', 'Remove access in one click'],
    sampleTitle: 'Team (sample)',
    sample: [['Director', 'Administrator'], ['Case manager', 'Staff'], ['Analyst', 'Reports only']],
  },
  auditLog: {
    headline: 'Know who did what, and when',
    bullets: ['A dated record of changes in your workspace', 'Answers an auditor’s question in seconds', 'Nothing to set up'],
    sampleTitle: 'Activity (sample)',
    sample: [['Nov 16', 'Grant shortlisted'], ['Nov 15', 'Partner view created']],
  },
  sso: {
    headline: 'Sign in with your own login',
    bullets: ['One login for your whole team', 'Access ends when your IT ends it', 'No extra passwords'],
    sampleTitle: 'Single sign-on (sample)',
    sample: [['Provider', 'Your identity provider']],
  },
  nextchapterServices: {
    headline: 'Put NextChapter’s coaching and courses to work for your people',
    bullets: ['Coaching and AI-skills courses for your participants', 'Their progress counts toward your outcomes', 'Free to start, then billed to you or a funder'],
    sampleTitle: 'Services (sample)',
    sample: [['AI skills for professionals', 'Course'], ['Interview coaching', 'Coaching']],
  },
  wioa: {
    headline: 'Workforce reporting without the spreadsheet',
    bullets: ['WIOA-ready counts and exports', 'Built from what your participants already do here', 'Ready before the reporting deadline'],
    sampleTitle: 'WIOA report (sample)',
    sample: [['Enrolled', '140'], ['Employed in Q2 after exit', '32']],
  },
  members: {
    headline: 'See everyone who joined',
    bullets: ['Every member by name, not just the first five', 'Filter by function, level and time out of work', 'Reach the people who need help first'],
    sampleTitle: 'Members (sample)',
    sample: [['Avery M.', 'Finance, 6 weeks out'], ['Jordan K.', 'Operations, 3 weeks out']],
  },
  grants: {
    headline: 'Never miss a grant that fits you',
    bullets: ['Every grant that fits, with our read on why', 'Deadlines, partners to bring in and the next move', 'A shortlist your team shares'],
    sampleTitle: 'Grants (sample)',
    sample: [['Best fit', 'Rolling, next close Dec 2'], ['Good fit', 'Closes Jan 15']],
  },
  skillsGaps: {
    headline: 'See every skill your region is short of, and how to close it',
    bullets: ['Demand from real postings against the skills your people show, skill by skill', 'The retraining that teaches each gap, and the gaps no program teaches yet', 'The evidence colleges and funders need to build the next cohort'],
    sampleTitle: 'Skills gaps (sample)',
    sample: [['Sales and negotiation', '14 points short'], ['People management', '6 points short'], ['Recruiting', '3 points short']],
  },
  publicPage: {
    headline: 'Tell your story on your own public page',
    bullets: ['Your section, your words, your jobs and events', 'Seen by everyone who finds your page', 'Updated whenever you like'],
    sampleTitle: 'Public page (sample)',
    sample: [['About us', 'Your section'], ['Jobs near you', 'Live']],
  },
  partnerViews: {
    headline: 'Give a college or employer a live view of your region',
    bullets: ['Skills in demand, talent counts and jobs, by a link you control', 'Colleges plan programs around what employers actually ask for', 'Expires on its own and switches off in one click'],
    sampleTitle: 'Partner view (sample)',
    sample: [['Sales and negotiation', '14 points short'], ['People management', '6 points short']],
  },
}

/** What a lock screen should offer: the trial if unused, the trial's end if used, nothing if the organization is on the paid plan. */
export function trialForLock(inst: { plan: string; storedPlan?: string; trialStartedAt?: Date | null; trialEndsAt?: Date | null }): 'available' | 'ended' | 'none' {
  const t = trialState(inst.storedPlan ?? inst.plan, inst.trialStartedAt, inst.trialEndsAt)
  return t.state === 'available' ? 'available' : t.state === 'ended' ? 'ended' : 'none'
}
