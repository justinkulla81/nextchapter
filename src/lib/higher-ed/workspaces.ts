// Higher Ed portal workspaces (spec §4). One typed, data-driven config: the
// rail, the tabs and requireWorkspace() all read this, so a V2 workspace is
// one more entry here, never a code change elsewhere. No 'server-only' —
// the client-side rail renders from it too. It is presentation and routing
// config; authorization happens in requireWorkspace() on the server.

import type { InstitutionOrgType, InstitutionTier, InstitutionUserRole } from '@prisma/client'
import { orgAppPath, type OrgHostKind } from '@/lib/org-hosts'

export type WorkspaceKey =
  | 'candidate'
  | 'alumni'
  | 'development'
  | 'career'
  | 'teaching'
  | 'execed'
  | 'employer'
  | 'admin'
  | 'workforce'
  // Workforce customers (boards, economic development orgs, chambers):
  // member companies, participants, layoffs, kept-in-region.
  | 'hub'
  // Their business side (owner, 2026-11-17): bringing employers to the region, and the businesses already here.
  | 'business'

// What a person holds at one institution. Staff roles come straight from
// InstitutionUser; a VIEWER seat is scoped to one workspace ("VIEWER:alumni");
// MEMBER is an InstitutionMember; EMPLOYER is a seat on an APPROVED
// InstitutionEmployer.
export type AccessToken = InstitutionUserRole | `VIEWER:${string}` | 'MEMBER' | 'EMPLOYER' | `EMPLOYER:${EmployerRole}`

// The part of a member company's view one of its people works in (MemberCompanyContact.roles, owner 2026-11-17).
// EMPLOYER alone is the company's main login and sees all of it.
export const EMPLOYER_ROLES = ['hiring', 'outplacement', 'learning', 'grants', 'workforce', 'colleges'] as const
export type EmployerRole = (typeof EMPLOYER_ROLES)[number]
export const EMPLOYER_ROLE_LABELS: Record<EmployerRole, string> = { hiring: 'Hiring', outplacement: 'Outplacement', learning: 'Learning and development', grants: 'Grants and RFPs', workforce: 'Workforce development partnerships', colleges: 'College partnerships' }
/** Whole-company access, or this role. */
export const employerCan = (tokens: ReadonlySet<AccessToken>, role: EmployerRole) => tokens.has('EMPLOYER') || tokens.has(`EMPLOYER:${role}`)

export type Release = 'V1' | 'V2'

export type WorkspaceTab = {
  key: string
  label: string
  // Which build step delivers the tab; null once it is built.
  comingIn: string | null
  // Narrower than the workspace's own requiredRoles, when set.
  requiredRoles?: AccessToken[]
  // Hidden from alumni when the college switches every one of these portal
  // features off (modules.ts). Staff tabs are never hidden; they say it's off.
  modules?: import('./modules').ModuleKey[]
  // Only for this kind of customer (omitted = both).
  orgKind?: OrgKind
  // Its name on a workforce customer's portal, when different.
  workforceLabel?: string
  // Only on demo workspaces (isDemo): screens built on sample data that a real
  // customer should not see until they hold real data.
  demoOnly?: boolean
  // Hidden when the person can open this workspace, which already holds the same screen (a free college's Admin ›
  // Grants, which Development holds on the paid tiers).
  hideWhenWorkspace?: WorkspaceKey
  // The section of a long tab list it sits under (a second row of navigation).
  group?: string
  // The screen belongs to another workspace and is shown here too (a workforce customer's Program holds what Exec Ed and the
  // WIOA workspace hold for a college). It shows only to someone who can open that workspace, and keeps that screen's plan lock.
  from?: { workspace: WorkspaceKey; tab: string }
}

export type WorkspaceConfig = {
  key: WorkspaceKey
  label: string
  // A lucide-react icon name, resolved by the rail.
  icon: 'GraduationCap' | 'Users' | 'HandCoins' | 'Compass' | 'Building2' | 'Settings' | 'BookOpen' | 'Presentation' | 'Landmark' | 'MessagesSquare' | 'MapPin'
  release: Release
  requiredRoles: AccessToken[]
  // Path under /i/[slug]; the first tab is the workspace home.
  homePath: string
  // Lowest license tier that includes this workspace (product design,
  // Packaging): Career < Advancement < Institution. Omitted = every tier.
  minTier?: InstitutionTier
  // Shown only when the college has this switched on (enabledFeatures).
  feature?: 'wioa'
  // Which kind of customer has it: colleges, workforce customers, or (omitted) both.
  orgKind?: OrgKind
  // Its name on a workforce customer's portal, when different.
  workforceLabel?: string
  tabs: WorkspaceTab[]
}

export const labelFor = (x: { label: string; workforceLabel?: string }, kind: OrgKind) => (kind === 'workforce' && x.workforceLabel ? x.workforceLabel : x.label)

// A college, or a workforce customer (board, economic development org,
// chamber, community org): the Institution's orgType.
export type OrgKind = 'college' | 'workforce'

export const orgKindOf = (t: InstitutionOrgType | null | undefined): OrgKind => (!t || t === 'COLLEGE' ? 'college' : 'workforce')

// The partner activity trail (src/lib/partners/audit.ts) keeps colleges and workforce organizations apart, though both
// are an Institution served from /i/<slug>.
export const auditPortalOf = (t: InstitutionOrgType | null | undefined): 'HIGHER_ED' | 'WORKFORCE' => (orgKindOf(t) === 'workforce' ? 'WORKFORCE' : 'HIGHER_ED')

// The portal's public address (src/lib/org-hosts.ts): its own subdomain
// (workforce. / highered.), or /workforce/<slug> and /highered/<slug> on the
// main host while subdomains are off. Served from /i/<slug> either way.
export const orgHostKindOf = (t: InstitutionOrgType | null | undefined): OrgHostKind => (orgKindOf(t) === 'workforce' ? 'workforce' : 'highered')
export const orgBasePath = (slug: string, t: InstitutionOrgType | null | undefined) => orgAppPath(slug, orgHostKindOf(t))

export const ORG_TYPE_LABELS: Record<InstitutionOrgType, string> = {
  COLLEGE: 'College or university',
  WORKFORCE_BOARD: 'Workforce board',
  ECONOMIC_DEVELOPMENT: 'Economic development',
  CHAMBER: 'Chamber of commerce',
  COMMUNITY_ORG: 'Community organization',
}

// Who can post alumni-only jobs and manage target companies matches
// src/lib/institution/permissions.ts (the capability map is the source of
// truth for the actions; these lists only decide which tabs show).
const POST_JOBS: AccessToken[] = ['INSTITUTION_ADMIN', 'CAREER_SERVICES', 'EMPLOYER_RELATIONS', 'ALUMNI_RELATIONS']
const TARGET_COMPANIES: AccessToken[] = ['INSTITUTION_ADMIN', 'CAREER_SERVICES', 'EMPLOYER_RELATIONS']

export const WORKSPACES: WorkspaceConfig[] = [
  {
    key: 'candidate',
    label: 'Candidate',
    // What a participant sees, for a workforce customer.
    workforceLabel: 'Participant view',
    icon: 'GraduationCap',
    release: 'V1',
    requiredRoles: ['MEMBER'],
    homePath: 'candidate',
    tabs: [
      { key: 'home', label: 'Home', comingIn: null },
      // A workforce participant's own NextChapter account lists the organization under Network › Groups.
      { key: 'groups', label: 'Groups', comingIn: null, orgKind: 'workforce' },
      { key: 'jobs', label: 'Jobs & projects', comingIn: null, modules: ['alumniJobs', 'projects'], orgKind: 'college' },
      // Internships live only in the college portal, never on the member job board.
      { key: 'internships', label: 'Internships', comingIn: null, modules: ['internships'], orgKind: 'college' },
      { key: 'network', label: 'People', comingIn: null, orgKind: 'college' },
      { key: 'mentors', label: 'Mentoring', comingIn: null, modules: ['mentors', 'mentoringCohorts'], orgKind: 'college' },
      { key: 'programs', label: 'Learn', comingIn: null, modules: ['programs', 'courseAuditing'] },
      { key: 'giveback', label: 'Give back', comingIn: null, modules: ['volunteer', 'giveBack', 'askAlumni'], orgKind: 'college' },
      { key: 'coaching', label: 'Coaching', comingIn: null },
      { key: 'privacy', label: 'Privacy', comingIn: null },
    ],
  },
  {
    key: 'alumni',
    label: 'Alumni Relations',
    icon: 'Users',
    release: 'V1',
    requiredRoles: ['ALUMNI_RELATIONS', 'INSTITUTION_ADMIN', 'VIEWER:alumni'],
    homePath: 'alumni',
    orgKind: 'college',
    tabs: [
      { key: 'home', label: 'Home', comingIn: null },
      { key: 'members', label: 'Members', comingIn: null },
      { key: 'jobs', label: 'Alumni jobs', comingIn: null, requiredRoles: POST_JOBS },
      { key: 'region', label: 'Local market', comingIn: null },
      { key: 'outreach', label: 'Outreach', comingIn: null },
      { key: 'mentors', label: 'Mentoring', comingIn: null },
      { key: 'events', label: 'Events', comingIn: null },
      { key: 'community', label: 'Groups, news & posts', comingIn: null },
      { key: 'volunteers', label: 'Volunteers', comingIn: null },
      { key: 'connect', label: 'Circles, fairs & class notes', comingIn: null },
      { key: 'engagement', label: 'Engagement', comingIn: null },
      { key: 'data', label: 'Alumni data', comingIn: null },
      // Layoffs come last: the workspace starts with what is going well (src/lib/higher-ed/workspaces.ts, owner rule 2026-10-27).
      { key: 'layoffs', label: 'Layoff alerts', comingIn: null },
    ],
  },
  {
    key: 'development',
    label: 'Development',
    icon: 'HandCoins',
    release: 'V1',
    requiredRoles: ['DEVELOPMENT', 'INSTITUTION_ADMIN', 'VIEWER:development'],
    homePath: 'development',
    minTier: 'ADVANCEMENT',
    orgKind: 'college',
    tabs: [
      { key: 'home', label: 'ROI dashboard', comingIn: null },
      { key: 'transition', label: 'In transition', comingIn: null },
      { key: 'signals', label: 'Signals', comingIn: null },
      { key: 'fund', label: 'Resilience Fund', comingIn: null },
      { key: 'grants', label: 'Grants and RFPs', comingIn: null },
      { key: 'crm', label: 'CRM exchange', comingIn: null },
    ],
  },
  {
    key: 'career',
    label: 'Career Services',
    icon: 'Compass',
    release: 'V1',
    // Coaches (a college's own) share the counselors' view of assigned members.
    requiredRoles: ['CAREER_SERVICES', 'EMPLOYER_RELATIONS', 'COACH', 'INSTITUTION_ADMIN', 'VIEWER:career'],
    homePath: 'career',
    orgKind: 'college',
    tabs: [
      { key: 'home', label: 'Caseload', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'COACH', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'coaching', label: 'Coaching', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'COACH', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'jobs', label: 'Alumni jobs', comingIn: null, requiredRoles: POST_JOBS },
      { key: 'companies', label: 'Target companies', comingIn: null, requiredRoles: TARGET_COMPANIES },
      { key: 'recruiting', label: 'Recruiting & internships', comingIn: null, requiredRoles: TARGET_COMPANIES },
      { key: 'outcomes', label: 'Outcomes', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'bridge', label: 'Skills bridge', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'checkins', label: 'Check-ins', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'students', label: 'Student tools', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'internships', label: 'Internships', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'COACH', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'circles', label: 'Circles & career fairs', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'COACH', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'region', label: 'Local market', comingIn: null },
      { key: 'employers', label: 'Employers', comingIn: null },
    ],
  },
  {
    key: 'teaching',
    label: 'Teaching',
    icon: 'Presentation',
    release: 'V1',
    requiredRoles: ['FACULTY', 'EXEC_ED', 'INSTITUTION_ADMIN', 'VIEWER:teaching'],
    homePath: 'teaching',
    minTier: 'INSTITUTION',
    orgKind: 'college',
    tabs: [
      { key: 'home', label: 'Courses', comingIn: null },
      { key: 'faculty', label: 'Faculty', comingIn: null },
      { key: 'capstones', label: 'Employer capstones', comingIn: null },
      { key: 'auditors', label: 'Alumni auditors', comingIn: null },
      { key: 'groups', label: 'Industry groups', comingIn: null },
    ],
  },
  {
    key: 'execed',
    label: 'Exec Ed',
    icon: 'BookOpen',
    release: 'V1',
    requiredRoles: ['EXEC_ED', 'FACULTY', 'INSTITUTION_ADMIN', 'VIEWER:execed'],
    homePath: 'execed',
    minTier: 'INSTITUTION',
    tabs: [
      { key: 'home', label: 'Programs', comingIn: null },
      { key: 'enrollments', label: 'Enrollments', comingIn: null },
      { key: 'clients', label: 'Corporate clients', comingIn: null },
      { key: 'bridge', label: 'Skills bridge', comingIn: null },
    ],
  },
  {
    key: 'employer',
    label: 'Employer',
    // A workforce org's member company: its layoffs, its people, its hiring.
    workforceLabel: 'Employer view',
    icon: 'Building2',
    release: 'V1',
    // A member company's people each see their part (hiring or outplacement); its main login sees all of it.
    requiredRoles: ['EMPLOYER', 'EMPLOYER:hiring', 'EMPLOYER:outplacement', 'EMPLOYER:learning', 'EMPLOYER:grants', 'EMPLOYER:workforce', 'EMPLOYER:colleges'],
    homePath: 'employer',
    tabs: [
      { key: 'overview', label: 'Overview', comingIn: null, orgKind: 'workforce' },
      { key: 'home', label: 'Shared Dossiers', workforceLabel: 'Hiring', comingIn: null, requiredRoles: ['EMPLOYER', 'EMPLOYER:hiring'] },
      { key: 'page', label: 'Employer page and roles', workforceLabel: 'Jobs you post', comingIn: null, requiredRoles: ['EMPLOYER', 'EMPLOYER:hiring'] },
      // Layoff support comes last: the workspace starts with hiring and jobs.
      { key: 'support', label: 'Layoff support', comingIn: null, orgKind: 'workforce', requiredRoles: ['EMPLOYER', 'EMPLOYER:outplacement'] },
      // L&D: ask the organization for training, against what local jobs ask for.
      { key: 'training', label: 'Training', comingIn: null, orgKind: 'workforce', requiredRoles: ['EMPLOYER', 'EMPLOYER:learning'] },
      // Grants and RFPs: the organization's applications that name the company, and support it offers.
      { key: 'grants', label: 'Grants and RFPs', comingIn: null, orgKind: 'workforce', requiredRoles: ['EMPLOYER', 'EMPLOYER:grants'] },
      // Workforce development: apprenticeships, on-the-job training, work experience, job-center hiring events, sector partnerships.
      { key: 'workforce', label: 'Workforce partnerships', comingIn: null, orgKind: 'workforce', requiredRoles: ['EMPLOYER', 'EMPLOYER:workforce'] },
      // Higher ed: internships, student projects, advisory boards, curriculum review, speakers, with colleges near the region.
      { key: 'colleges', label: 'College partnerships', comingIn: null, orgKind: 'workforce', requiredRoles: ['EMPLOYER', 'EMPLOYER:colleges'] },
    ],
  },
  {
    // A workforce customer's own work: the companies it serves, the people
    // it's helping, layoffs in its region, and how many it kept local.
    key: 'hub',
    label: 'Talent Hub',
    icon: 'MapPin',
    release: 'V1',
    requiredRoles: ['INSTITUTION_ADMIN', 'WORKFORCE_PARTNER', 'CAREER_SERVICES', 'EMPLOYER_RELATIONS', 'VIEWER:hub'],
    homePath: 'hub',
    orgKind: 'workforce',
    tabs: [
      { key: 'home', label: 'Home', comingIn: null, group: 'Home' },
      // Everyone the organization helps, by track, with the benefits matched to each person (src/lib/workforce/people-crm.ts).
      { key: 'participants', label: 'People', comingIn: null, group: 'People' },
      { key: 'pipeline', label: 'Pipeline', comingIn: null, demoOnly: true, group: 'People' },
      { key: 'attract', label: 'Attract', comingIn: null, demoOnly: true, group: 'People' },
      { key: 'benefits', label: 'Benefits', comingIn: null, demoOnly: true, group: 'People' },
      { key: 'wioa', label: 'WIOA participants', comingIn: null, group: 'People', from: { workspace: 'workforce', tab: 'home' } },
      { key: 'companies', label: 'Member companies', comingIn: null, group: 'Employers' },
      { key: 'clients', label: 'Corporate clients', comingIn: null, group: 'Employers', from: { workspace: 'execed', tab: 'clients' } },
      { key: 'upskill', label: 'Upskilling', comingIn: null, demoOnly: true, group: 'Employers' },
      { key: 'skills', label: 'Future skills', comingIn: null, demoOnly: true, group: 'Employers' },
      { key: 'rapid', label: 'Rapid response', comingIn: null, demoOnly: true, group: 'Employers' },
      { key: 'responses', label: 'Rapid response', comingIn: null, group: 'Employers', from: { workspace: 'workforce', tab: 'rapid' } },
      // Layoff seats come after the rapid-response plan.
      { key: 'layoffs', label: 'Layoff seats', comingIn: null, group: 'Employers' },
      { key: 'learning', label: 'Colleges and partners', comingIn: null, demoOnly: true, group: 'Partners' },
      { key: 'system', label: 'Board and job centers', comingIn: null, demoOnly: true, group: 'Partners' },
      { key: 'programs', label: 'Programs', comingIn: null, group: 'Partners', from: { workspace: 'execed', tab: 'home' } },
      { key: 'enrollments', label: 'Enrollments', comingIn: null, group: 'Partners', from: { workspace: 'execed', tab: 'enrollments' } },
      { key: 'ecosystem', label: 'Ecosystem', comingIn: null, group: 'Partners' },
      { key: 'views', label: 'Partner views', comingIn: null, group: 'Partners' },
      { key: 'etpl', label: 'Eligible training list', comingIn: null, group: 'Partners', from: { workspace: 'workforce', tab: 'etpl' } },
      { key: 'applications', label: 'Applications', comingIn: null, group: 'Funding' },
      { key: 'grantlist', label: 'Grants to apply for', comingIn: null, group: 'Funding' },
      { key: 'funding', label: 'Grants and funding', comingIn: null, demoOnly: true, group: 'Funding' },
      { key: 'regionjobs', label: 'Jobs in your region', comingIn: null, group: 'Jobs' },
      { key: 'groupjobs', label: 'Jobs for your group', comingIn: null, group: 'Jobs' },
      { key: 'employerjobs', label: 'Employer jobs', comingIn: null, group: 'Jobs' },
      { key: 'region', label: 'Local market', comingIn: null, group: 'Market' },
      { key: 'jobs', label: 'Jobs and skills', comingIn: null, demoOnly: true, group: 'Market' },
      { key: 'skillsgap', label: 'Skills gaps', comingIn: null, group: 'Market' },
      { key: 'talent', label: 'Talent snapshot', comingIn: null, group: 'Market' },
      { key: 'report', label: 'Outcomes report', comingIn: null, group: 'Reports' },
      { key: 'local', label: 'Kept in region', comingIn: null, group: 'Reports' },
      { key: 'grants', label: 'Grant reporting', comingIn: null, demoOnly: true, group: 'Reports' },
      { key: 'public', label: 'Public pages and previews', comingIn: null, group: 'Public presence' },
    ],
  },
  {
    // A workforce customer's business side (owner, 2026-11-17), next to Talent Hub: companies that could move or expand here,
    // a pitch built from the region's own data, and the employers and small businesses already here.
    key: 'business',
    label: 'Business Hub',
    icon: 'Building2',
    release: 'V1',
    requiredRoles: ['INSTITUTION_ADMIN', 'WORKFORCE_PARTNER', 'EMPLOYER_RELATIONS', 'VIEWER:business'],
    homePath: 'business',
    orgKind: 'workforce',
    tabs: [
      { key: 'home', label: 'Overview', comingIn: null },
      { key: 'leads', label: 'Expansion leads', comingIn: null },
      { key: 'pitch', label: 'Pitch builder', comingIn: null },
      { key: 'incentives', label: 'Incentives and costs', comingIn: null },
      { key: 'employers', label: 'Big employers', comingIn: null },
      { key: 'small', label: 'Startups and small business', comingIn: null },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: 'Settings',
    release: 'V1',
    requiredRoles: ['INSTITUTION_ADMIN'],
    homePath: 'admin',
    tabs: [
      { key: 'home', label: 'Overview', comingIn: null },
      { key: 'services', label: 'Services', comingIn: null },
      { key: 'users', label: 'Staff', comingIn: null },
      { key: 'activity', label: 'Activity', comingIn: null },
      { key: 'branding', label: 'Branding', comingIn: null },
      { key: 'grants', label: 'Grants', comingIn: null, orgKind: 'college', hideWhenWorkspace: 'development' },
      { key: 'roster', label: 'Roster', comingIn: null },
      { key: 'board', label: 'Board report', comingIn: null },
      { key: 'privacy', label: 'Privacy requests', comingIn: null },
    ],
  },
  {
    // The local workforce board's view of WIOA-funded training (spec §13):
    // participants, completions and placements. Read-only for the board's
    // staff; shows how to switch it on until Admin turns WIOA on.
    key: 'workforce',
    label: 'Workforce board',
    icon: 'Landmark',
    release: 'V1',
    requiredRoles: ['WORKFORCE_PARTNER', 'INSTITUTION_ADMIN', 'EXEC_ED'],
    homePath: 'workforce',
    minTier: 'INSTITUTION',
    feature: 'wioa',
    tabs: [
      { key: 'home', label: 'WIOA participants', comingIn: null },
      { key: 'rapid', label: 'Rapid response', comingIn: null },
      { key: 'etpl', label: 'Eligible-provider listing', comingIn: null },
    ],
  },
]

export const V1_WORKSPACE_KEYS = WORKSPACES.filter((w) => w.release === 'V1').map((w) => w.key)

export function getWorkspace(key: string): WorkspaceConfig | undefined {
  return WORKSPACES.find((w) => w.key === key)
}

function holdsAny(tokens: ReadonlySet<AccessToken>, required: AccessToken[]): boolean {
  return required.some((r) => tokens.has(r))
}

const TIER_RANK: Record<InstitutionTier, number> = { CAREER: 0, ADVANCEMENT: 1, INSTITUTION: 2 }

export function tierIncludes(tier: InstitutionTier, ws: WorkspaceConfig): boolean {
  return !ws.minTier || TIER_RANK[tier] >= TIER_RANK[ws.minTier]
}

export const TIER_LABELS: Record<InstitutionTier, string> = { CAREER: 'Career', ADVANCEMENT: 'Advancement', INSTITUTION: 'Institution' }

export type WorkspaceFeatures = { wioa?: boolean }

/** The feature switches in an institution's enabledFeatures JSON that gate workspaces. */
export function workspaceFeaturesOf(enabledFeatures: unknown): WorkspaceFeatures {
  return { wioa: (enabledFeatures as { wioa?: boolean } | null)?.wioa === true }
}

const featureOn = (w: WorkspaceConfig, features: WorkspaceFeatures) => !w.feature || features[w.feature] === true
const kindOn = (w: WorkspaceConfig, kind: OrgKind) => !w.orgKind || w.orgKind === kind

// The V1 workspaces these tokens open on this license tier, in rail order.
// No tier = ignore tiers (tests, config checks). Feature-gated workspaces
// (the Workforce board) need the college to have switched them on.
export function workspacesFor(tokens: ReadonlySet<AccessToken>, tier?: InstitutionTier, features: WorkspaceFeatures = {}, kind: OrgKind = 'college'): WorkspaceKey[] {
  return WORKSPACES.filter((w) => w.release === 'V1' && kindOn(w, kind) && featureOn(w, features) && holdsAny(tokens, w.requiredRoles) && (!tier || tierIncludes(tier, w))).map(
    (w) => w.key,
  )
}

// Workspaces a role would open but the license tier doesn't include: shown
// locked to admins, with the tier that adds them.
export function lockedWorkspacesFor(tokens: ReadonlySet<AccessToken>, tier: InstitutionTier, features: WorkspaceFeatures = {}, kind: OrgKind = 'college'): WorkspaceConfig[] {
  return WORKSPACES.filter((w) => w.release === 'V1' && kindOn(w, kind) && featureOn(w, features) && holdsAny(tokens, w.requiredRoles) && !tierIncludes(tier, w))
}

// True when the ONLY thing opening this workspace is a VIEWER seat.
export function isReadOnlyIn(tokens: ReadonlySet<AccessToken>, key: WorkspaceKey): boolean {
  const ws = getWorkspace(key)
  if (!ws) return true
  const full = ws.requiredRoles.filter((r) => !r.startsWith('VIEWER:'))
  return !holdsAny(tokens, full) && tokens.has(`VIEWER:${key}`)
}

// `modules` (the college's portal features) hides a tab whose features are
// all switched off; omitted = don't filter on features.
export function tabsFor(tokens: ReadonlySet<AccessToken>, key: WorkspaceKey, modules?: Partial<Record<import('./modules').ModuleKey, boolean>>, kind: OrgKind = 'college'): WorkspaceTab[] {
  const ws = getWorkspace(key)
  if (!ws) return []
  return ws.tabs.filter(
    (t) => (!t.orgKind || t.orgKind === kind) && (!t.requiredRoles || holdsAny(tokens, t.requiredRoles)) && (!modules || !t.modules || t.modules.some((m) => modules[m] !== false)),
  )
}

// Every token, for an nc_admin on a demo tenant (or in "View as").
export const ALL_TOKENS: ReadonlySet<AccessToken> = new Set<AccessToken>([
  'INSTITUTION_ADMIN',
  'ALUMNI_RELATIONS',
  'DEVELOPMENT',
  'CAREER_SERVICES',
  'EMPLOYER_RELATIONS',
  'COACH',
  'FACULTY',
  'EXEC_ED',
  'WORKFORCE_PARTNER',
  'MEMBER',
  'EMPLOYER',
])

// Demo-only "Preview as" personas: an nc_admin on a demo tenant can narrow
// what they see to exactly one seeded role, to check the rail per role
// without separate logins.
export const DEMO_PERSONAS = [
  { key: 'all', label: 'Everything (nc_admin)', tokens: [...ALL_TOKENS] },
  { key: 'INSTITUTION_ADMIN', label: 'Institution admin', tokens: ['INSTITUTION_ADMIN'] },
  { key: 'ALUMNI_RELATIONS', label: 'Alumni Relations', tokens: ['ALUMNI_RELATIONS'] },
  { key: 'DEVELOPMENT', label: 'Development', tokens: ['DEVELOPMENT'] },
  { key: 'CAREER_SERVICES', label: 'Career Services', tokens: ['CAREER_SERVICES'] },
  { key: 'EMPLOYER_RELATIONS', label: 'Employer Relations', tokens: ['EMPLOYER_RELATIONS'] },
  { key: 'COACH', label: 'Coach', tokens: ['COACH'] },
  { key: 'FACULTY', label: 'Faculty', tokens: ['FACULTY'] },
  { key: 'EXEC_ED', label: 'Exec Ed staff', tokens: ['EXEC_ED'] },
  { key: 'WORKFORCE_PARTNER', label: 'Workforce board', tokens: ['WORKFORCE_PARTNER'] },
  { key: 'MEMBER', label: 'Alum (candidate)', tokens: ['MEMBER'] },
  { key: 'EMPLOYER', label: 'Employer', tokens: ['EMPLOYER'] },
  // Workforce only: one person at a member company, by the part of its view they work in.
  { key: 'EMPLOYER:hiring', label: 'Employer: hiring', tokens: ['EMPLOYER:hiring'] },
  { key: 'EMPLOYER:outplacement', label: 'Employer: outplacement', tokens: ['EMPLOYER:outplacement'] },
  { key: 'EMPLOYER:learning', label: 'Employer: learning and development', tokens: ['EMPLOYER:learning'] },
  { key: 'EMPLOYER:grants', label: 'Employer: grants and RFPs', tokens: ['EMPLOYER:grants'] },
  { key: 'EMPLOYER:workforce', label: 'Employer: workforce development partnerships', tokens: ['EMPLOYER:workforce'] },
  { key: 'EMPLOYER:colleges', label: 'Employer: college partnerships', tokens: ['EMPLOYER:colleges'] },
] as const satisfies readonly { key: string; label: string; tokens: readonly AccessToken[] }[]

export type DemoPersonaKey = (typeof DEMO_PERSONAS)[number]['key']

// A workforce organization's staff roles, by the offices it has (services.ts: program team, business services,
// career center). Faculty, Exec Ed, Alumni Relations, Development and Coach are college roles: a workforce org's
// programs, enrollments and corporate clients are Talent Hub tabs, not an Exec Ed office.
export const WORKFORCE_STAFF_ROLES = ['INSTITUTION_ADMIN', 'WORKFORCE_PARTNER', 'EMPLOYER_RELATIONS', 'CAREER_SERVICES', 'VIEWER'] as const satisfies readonly InstitutionUserRole[]
const WORKFORCE_ROLE_LABELS: Partial<Record<InstitutionUserRole, string>> = {
  INSTITUTION_ADMIN: 'Director (admin)',
  WORKFORCE_PARTNER: 'Program team',
  EMPLOYER_RELATIONS: 'Business services',
  CAREER_SERVICES: 'Career center',
}
export const staffRoleLabel = (role: InstitutionUserRole, kind: OrgKind): string =>
  (kind === 'workforce' ? WORKFORCE_ROLE_LABELS[role] : undefined) ?? STAFF_ROLE_LABELS[role]

// The personas that open at least one workspace for this kind of org, with
// workforce wording (a member there is a participant, not an alum). `group`
// splits staff roles from the outside views (the people and companies served).
export function demoPersonasFor(kind: OrgKind, tier: InstitutionTier): { key: string; label: string; group: 'all' | 'staff' | 'outside' }[] {
  const workforceKeys: string[] = ['all', ...WORKFORCE_STAFF_ROLES, 'MEMBER', 'EMPLOYER', 'EMPLOYER:hiring', 'EMPLOYER:outplacement', 'EMPLOYER:learning', 'EMPLOYER:grants', 'EMPLOYER:workforce', 'EMPLOYER:colleges']
  return DEMO_PERSONAS.filter((p) => (kind === 'workforce' ? workforceKeys.includes(p.key) : !p.key.startsWith('EMPLOYER:')) && workspacesFor(new Set<AccessToken>(p.tokens), tier, { wioa: true }, kind).length > 0).map((p) => ({
    key: p.key,
    group: p.key === 'all' ? 'all' : p.key === 'MEMBER' || p.key.startsWith('EMPLOYER') ? 'outside' : 'staff',
    label:
      kind === 'workforce'
        ? ({ all: 'Everything (all roles)', MEMBER: 'Participant (job seeker)', EMPLOYER: 'Member company: whole company', 'EMPLOYER:hiring': 'Member company: hiring', 'EMPLOYER:outplacement': 'Member company: outplacement', 'EMPLOYER:learning': 'Member company: learning and development', 'EMPLOYER:grants': 'Member company: grants and RFPs', 'EMPLOYER:workforce': 'Member company: workforce development', 'EMPLOYER:colleges': 'Member company: college partnerships' } as Record<string, string>)[p.key] ?? staffRoleLabel(p.key as InstitutionUserRole, kind)
        : p.key === 'all'
          ? 'Everything (all roles)'
          : p.label,
  }))
}

export function demoPersonaTokens(key: string | undefined): ReadonlySet<AccessToken> {
  const persona = DEMO_PERSONAS.find((p) => p.key === key) ?? DEMO_PERSONAS[0]
  return new Set<AccessToken>(persona.tokens)
}

export const STAFF_ROLE_LABELS: Record<InstitutionUserRole, string> = {
  INSTITUTION_ADMIN: 'Institution admin',
  ALUMNI_RELATIONS: 'Alumni Relations',
  DEVELOPMENT: 'Development',
  CAREER_SERVICES: 'Career Services',
  EMPLOYER_RELATIONS: 'Employer Relations',
  COACH: 'Coach',
  FACULTY: 'Faculty',
  EXEC_ED: 'Exec Ed',
  WORKFORCE_PARTNER: 'Workforce board partner',
  VIEWER: 'Viewer',
}

// Where the Home splash picture, logo and line are changed (Admin › Branding), or null for someone who cannot change them:
// it needs the Admin workspace, and a demo guest pass is read-only.
export function brandingEditPath(ctx: { institution: { slug: string; orgType: InstitutionOrgType | null }; workspaces: readonly string[]; mode: string }): string | null {
  if (!ctx.workspaces.includes('admin') || ctx.mode === 'demo-guest') return null
  return `${orgBasePath(ctx.institution.slug, ctx.institution.orgType)}/admin/branding`
}
