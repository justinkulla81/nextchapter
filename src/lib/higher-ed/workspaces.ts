// Higher Ed portal workspaces (spec §4). One typed, data-driven config: the
// rail, the tabs and requireWorkspace() all read this, so a V2 workspace is
// one more entry here, never a code change elsewhere. No 'server-only' —
// the client-side rail renders from it too. It is presentation and routing
// config; authorization happens in requireWorkspace() on the server.

import type { InstitutionTier, InstitutionUserRole } from '@prisma/client'

export type WorkspaceKey =
  | 'candidate'
  | 'alumni'
  | 'development'
  | 'career'
  | 'teaching'
  | 'execed'
  | 'employer'
  | 'admin'
  // V2, shown greyed out as "Coming" on demo tenants only.
  | 'workforce'

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
}

export type WorkspaceConfig = {
  key: WorkspaceKey
  label: string
  // A lucide-react icon name, resolved by the rail.
  icon: 'GraduationCap' | 'Users' | 'HandCoins' | 'Compass' | 'Building2' | 'Settings' | 'BookOpen' | 'Presentation' | 'Landmark' | 'MessagesSquare'
  release: Release
  requiredRoles: AccessToken[]
  // Path under /i/[slug]; the first tab is the workspace home.
  homePath: string
  // Lowest license tier that includes this workspace (product design,
  // Packaging): Career < Advancement < Institution. Omitted = every tier.
  minTier?: InstitutionTier
  tabs: WorkspaceTab[]
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
      { key: 'coaching', label: 'Coaching', comingIn: null },
      { key: 'privacy', label: 'Privacy & sharing', comingIn: null },
      { key: 'mentors', label: 'Mentors', comingIn: null },
    ],
  },
  {
    key: 'alumni',
    label: 'Alumni Relations',
    icon: 'Users',
    release: 'V1',
    requiredRoles: ['ALUMNI_RELATIONS', 'INSTITUTION_ADMIN', 'VIEWER:alumni'],
    homePath: 'alumni',
    tabs: [
      { key: 'home', label: 'Home', comingIn: null },
      { key: 'members', label: 'Members', comingIn: null },
      { key: 'jobs', label: 'Alumni jobs', comingIn: null, requiredRoles: POST_JOBS },
      { key: 'region', label: 'Local market', comingIn: null },
      { key: 'layoffs', label: 'Layoff alerts', comingIn: 'HE-08' },
      { key: 'outreach', label: 'Outreach', comingIn: 'HE-08' },
      { key: 'mentors', label: 'Mentors', comingIn: null },
      { key: 'engagement', label: 'Engagement', comingIn: 'HE-07' },
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
    tabs: [
      { key: 'home', label: 'ROI dashboard', comingIn: null },
      { key: 'transition', label: 'In transition', comingIn: null },
      { key: 'signals', label: 'Signals', comingIn: 'HE-10' },
      { key: 'fund', label: 'Resilience Fund', comingIn: 'HE-10' },
      { key: 'crm', label: 'CRM exchange', comingIn: 'HE-05' },
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
    tabs: [
      { key: 'home', label: 'Caseload', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'COACH', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'coaching', label: 'Coaching', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'COACH', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'jobs', label: 'Alumni jobs', comingIn: null, requiredRoles: POST_JOBS },
      { key: 'companies', label: 'Target companies', comingIn: null, requiredRoles: TARGET_COMPANIES },
      { key: 'outcomes', label: 'Outcomes', comingIn: null, requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'checkins', label: 'Check-ins', comingIn: 'HE-11', requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'students', label: 'Student tools', comingIn: 'HE-11', requiredRoles: ['CAREER_SERVICES', 'INSTITUTION_ADMIN', 'VIEWER:career'] },
      { key: 'region', label: 'Local market', comingIn: null },
      { key: 'employers', label: 'Employers', comingIn: 'HE-11' },
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
    tabs: [
      { key: 'home', label: 'Courses', comingIn: null },
      { key: 'faculty', label: 'Faculty', comingIn: null },
      { key: 'capstones', label: 'Employer capstones', comingIn: 'V2' },
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
      { key: 'enrollments', label: 'Enrollments', comingIn: 'V2' },
      { key: 'clients', label: 'Corporate clients', comingIn: 'V2' },
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
      { key: 'page', label: 'Employer page and roles', comingIn: 'HE-13' },
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
    ],
  },
  { key: 'workforce', label: 'Workforce board', icon: 'Landmark', release: 'V2', requiredRoles: [], homePath: 'workforce', tabs: [] },
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

// The V1 workspaces these tokens open on this license tier, in rail order.
// No tier = ignore tiers (tests, config checks).
export function workspacesFor(tokens: ReadonlySet<AccessToken>, tier?: InstitutionTier): WorkspaceKey[] {
  return WORKSPACES.filter((w) => w.release === 'V1' && holdsAny(tokens, w.requiredRoles) && (!tier || tierIncludes(tier, w))).map(
    (w) => w.key,
  )
}

// Workspaces a role would open but the license tier doesn't include: shown
// locked to admins, with the tier that adds them.
export function lockedWorkspacesFor(tokens: ReadonlySet<AccessToken>, tier: InstitutionTier): WorkspaceConfig[] {
  return WORKSPACES.filter((w) => w.release === 'V1' && holdsAny(tokens, w.requiredRoles) && !tierIncludes(tier, w))
}

// True when the ONLY thing opening this workspace is a VIEWER seat.
export function isReadOnlyIn(tokens: ReadonlySet<AccessToken>, key: WorkspaceKey): boolean {
  const ws = getWorkspace(key)
  if (!ws) return true
  const full = ws.requiredRoles.filter((r) => !r.startsWith('VIEWER:'))
  return !holdsAny(tokens, full) && tokens.has(`VIEWER:${key}`)
}

export function tabsFor(tokens: ReadonlySet<AccessToken>, key: WorkspaceKey): WorkspaceTab[] {
  const ws = getWorkspace(key)
  if (!ws) return []
  return ws.tabs.filter((t) => !t.requiredRoles || holdsAny(tokens, t.requiredRoles))
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
  { key: 'MEMBER', label: 'Alum (candidate)', tokens: ['MEMBER'] },
  { key: 'EMPLOYER', label: 'Employer', tokens: ['EMPLOYER'] },
] as const satisfies readonly { key: string; label: string; tokens: readonly AccessToken[] }[]

export type DemoPersonaKey = (typeof DEMO_PERSONAS)[number]['key']

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
  VIEWER: 'Viewer',
}
