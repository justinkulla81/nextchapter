// Higher Ed portal workspaces (spec §4). One typed, data-driven config: the
// rail, the tabs and requireWorkspace() all read this, so a V2 workspace is
// one more entry here, never a code change elsewhere. No 'server-only' —
// the client-side rail renders from it too. It is presentation and routing
// config; authorization happens in requireWorkspace() on the server.

import type { InstitutionOrgType, InstitutionTier, InstitutionUserRole } from '@prisma/client'

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

// What a person holds at one institution. Staff roles come straight from
// InstitutionUser; a VIEWER seat is scoped to one workspace ("VIEWER:alumni");
// MEMBER is an InstitutionMember; EMPLOYER is a seat on an APPROVED
// InstitutionEmployer.
export type AccessToken = InstitutionUserRole | `VIEWER:${string}` | 'MEMBER' | 'EMPLOYER'

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
  tabs: WorkspaceTab[]
}

// A college, or a workforce customer (board, economic development org,
// chamber, community org): the Institution's orgType.
export type OrgKind = 'college' | 'workforce'

export const orgKindOf = (t: InstitutionOrgType | null | undefined): OrgKind => (!t || t === 'COLLEGE' ? 'college' : 'workforce')

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
    icon: 'GraduationCap',
    release: 'V1',
    requiredRoles: ['MEMBER'],
    homePath: 'candidate',
    tabs: [
      { key: 'home', label: 'Home', comingIn: null },
      { key: 'jobs', label: 'Jobs & projects', comingIn: null, modules: ['alumniJobs', 'projects'], orgKind: 'college' },
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
      { key: 'layoffs', label: 'Layoff alerts', comingIn: null },
      { key: 'outreach', label: 'Outreach', comingIn: null },
      { key: 'mentors', label: 'Mentoring', comingIn: null },
      { key: 'events', label: 'Events', comingIn: null },
      { key: 'community', label: 'Groups, news & posts', comingIn: null },
      { key: 'volunteers', label: 'Volunteers', comingIn: null },
      { key: 'connect', label: 'Circles, fairs & class notes', comingIn: null },
      { key: 'engagement', label: 'Engagement', comingIn: null },
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
      { key: 'outcomes', label: 'Outcomes', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'checkins', label: 'Check-ins', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'students', label: 'Student tools', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
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
    ],
  },
  {
    key: 'employer',
    label: 'Employer',
    icon: 'Building2',
    release: 'V1',
    requiredRoles: ['EMPLOYER'],
    homePath: 'employer',
    tabs: [
      { key: 'home', label: 'Shared Dossiers', comingIn: null },
      { key: 'page', label: 'Employer page and roles', comingIn: null },
    ],
  },
  {
    // A workforce customer's own work: the companies it serves, the people
    // it's helping, layoffs in its region, and how many it kept local.
    key: 'hub',
    label: 'Program',
    icon: 'MapPin',
    release: 'V1',
    requiredRoles: ['INSTITUTION_ADMIN', 'WORKFORCE_PARTNER', 'CAREER_SERVICES', 'EMPLOYER_RELATIONS', 'VIEWER:hub'],
    homePath: 'hub',
    orgKind: 'workforce',
    tabs: [
      { key: 'home', label: 'Dashboard', comingIn: null },
      { key: 'companies', label: 'Member companies', comingIn: null },
      { key: 'layoffs', label: 'Layoffs', comingIn: null },
      { key: 'participants', label: 'Participants', comingIn: null },
      { key: 'local', label: 'Kept in region', comingIn: null },
      { key: 'region', label: 'Local market', comingIn: null },
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
      { key: 'branding', label: 'Branding', comingIn: null },
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
] as const satisfies readonly { key: string; label: string; tokens: readonly AccessToken[] }[]

export type DemoPersonaKey = (typeof DEMO_PERSONAS)[number]['key']

// The personas that open at least one workspace for this kind of org, with
// workforce wording (a member there is a participant, not an alum).
export function demoPersonasFor(kind: OrgKind, tier: InstitutionTier): { key: string; label: string }[] {
  return DEMO_PERSONAS.filter((p) => workspacesFor(new Set<AccessToken>(p.tokens), tier, { wioa: true }, kind).length > 0).map((p) => ({
    key: p.key,
    label:
      ({ all: 'Everything', ...(kind === 'workforce' ? { MEMBER: 'Participant (job seeker)', WORKFORCE_PARTNER: 'Program staff', EMPLOYER: 'Hiring member company' } : {}) } as Record<string, string>)[p.key] ?? p.label,
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
