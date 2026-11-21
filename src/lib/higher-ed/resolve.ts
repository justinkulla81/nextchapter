// Higher Ed role resolution (spec §2), with no Next.js imports so scripts
// and tests can run it. The request-facing gate is requireWorkspace() in
// ./access.ts, which calls this on every request.

import { effectivePlan } from '@/lib/plans/entitlements'
import 'server-only'
import type { InstitutionOrgType, InstitutionTier, InstitutionUserRole, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin/is-admin-email'
import { adminMfaSatisfied, type Aal } from '@/lib/admin/mfa'
import { demoAlumMember } from './demo-alumni'
import { workspacesForStart } from './demo-start-shared'
import { ALL_TOKENS, demoPersonaTokens, EMPLOYER_ROLES, orgKindOf, workspaceFeaturesOf, workspacesFor, type AccessToken, type EmployerRole, type WorkspaceKey } from './workspaces'

type Db = PrismaClient | Prisma.TransactionClient

export const DEMO_PREVIEW_COOKIE = 'he_demo_preview'
// A "View as" on a real tenant lasts this long after its AdminAccessLog row.
export const VIEW_AS_TTL_MS = 60 * 60 * 1000
export const VIEW_AS_SURFACE = 'view-as'

export type InstitutionBranding = {
  id: string
  slug: string
  name: string
  programBrandName: string | null
  logoUrl: string | null
  accentColor: string | null
  isDemo: boolean
  tier: InstitutionTier
  // 'FREE' or 'PAID' (src/lib/plans/entitlements.ts).
  plan: string
  // The plan as stored, before a running trial is applied.
  storedPlan?: string
  // A FREE organization's one trial: while it runs `plan` reads PAID (effectivePlan); these let screens say where it stands.
  trialStartedAt?: Date | null
  trialEndsAt?: Date | null
  orgType: InstitutionOrgType
}

export type UnitScope = { id: string; name: string; school: string; department: string | null }

export type InstitutionAccess = {
  institution: InstitutionBranding
  userId: string
  email: string | null
  // What the person really holds here, before any nc_admin widening.
  ownTokens: ReadonlySet<AccessToken>
  // What this request may use: ownTokens, or everything for an nc_admin on
  // a demo tenant (narrowed by "Preview as") or inside an active View-as.
  tokens: ReadonlySet<AccessToken>
  workspaces: WorkspaceKey[]
  isNcAdmin: boolean
  // 'own' = the person's own roles; 'demo-admin' = nc_admin on a demo
  // tenant; 'view-as' = nc_admin with a logged View-as on a real tenant;
  // 'demo-guest' = a prospect's guest pass to a demo they generated (read-only).
  mode: 'own' | 'demo-admin' | 'view-as' | 'demo-guest'
  // Which login this request came from: the org portal's, the candidate
  // site's (members only), or a demo guest pass.
  via?: 'org' | 'candidate' | 'guest'
  demoPersona: string | null
  // A college demo's "Start with" choice (DEMO_STARTS): which offices are on. Null outside demos.
  demoStart?: string | null
  staffUsers: { id: string; role: InstitutionUserRole; workspace: string | null; unitId?: string | null }[]
  // The schools or departments this person's staff seats are limited to (InstitutionUnit). Null or absent = the whole
  // institution. Their members are only the alumni of those units, and `institution.plan` is the units' plan.
  units?: UnitScope[] | null
  memberId: string | null
  employerProfileIds: string[]
  // The member company a contact works for (MemberCompanyContact), when they hold a role there and not the whole company.
  memberCompanyIds?: string[]
  // The ecosystem partner(s) a person at a partner works for. On a demo, the preview acts as its first confirmed partner.
  partnerIds?: string[]
}

// A demo preview as a partner acts as the demo's first confirmed partner. Never used for a real tenant: only a demo's seeded partners.
async function demoConfirmedPartners(db: Db, institution: { id: string; isDemo: boolean }): Promise<string[]> {
  if (!institution.isDemo) return []
  const p = await db.ecosystemPartner.findFirst({ where: { institutionId: institution.id, status: 'CONFIRMED' }, orderBy: { createdAt: 'asc' }, select: { id: true } })
  return p ? [p.id] : []
}

async function demoFeaturedMember(db: Db, institution: { id: string; slug: string }, demoAlum?: string | null): Promise<string | null> {
  // The demo bar's "Sample alum" choice (./demo-alumni.ts), else the seeded featured alum.
  const chosen = await demoAlumMember(db, institution, demoAlum)
  if (chosen) return chosen
  const m = await db.institutionMember.findFirst({ where: { id: `${institution.slug}_member_featured`, institutionId: institution.id }, select: { id: true } })
  return m?.id ?? null
}

// `aal` is the assurance level of the session asking. With ADMIN_MFA_REQUIRED
// on, admin powers need a two-step (aal2) session here too, or these portals
// would be a way around the admin portal's MFA; without it the person keeps
// only their own roles. Callers that don't pass it get no admin powers then.
export async function isNcAdmin(userId: string, email: string | null, db: Db = prisma, aal: Aal | null = null): Promise<boolean> {
  if (!adminMfaSatisfied(aal)) return false
  if (isAdminEmail(email)) return true
  const grant = await db.roleGrant.findFirst({
    where: { userId, role: 'nc_admin', revokedAt: null },
    select: { id: true },
  })
  return !!grant
}

// Pure resolution against the database. `db` lets the HE-02 verification
// run it inside a rolled-back transaction.
export async function resolveInstitutionAccess(
  args: {
    slug: string
    userId: string
    email: string | null
    demoPersona?: string | null
    // The demo bar's sample-alum choice (DEMO_ALUM_COOKIE).
    demoAlum?: string | null
    // The demo bar's "Start with" choice (DEMO_START_COOKIE).
    demoStart?: string | null
    now?: Date
    // A candidate-portal session: only the person's own membership counts
    // (the Candidate workspace), never staff, employer or admin roles.
    memberOnly?: boolean
    // The session's assurance level, for NextChapter-admin powers (see isNcAdmin).
    aal?: Aal | null
  },
  db: Db = prisma,
): Promise<InstitutionAccess | null> {
  const row = await db.institution.findUnique({
    where: { slug: args.slug },
    select: { id: true, slug: true, name: true, programBrandName: true, logoUrl: true, accentColor: true, isDemo: true, tier: true, plan: true, trialStartedAt: true, trialEndsAt: true, orgType: true, enabledFeatures: true },
  })
  if (!row) return null
  // enabledFeatures decides which feature-gated workspaces exist here; it
  // isn't part of the branding handed to pages.
  const { enabledFeatures, ...stored } = row
  const institution = { ...stored, plan: effectivePlan(stored.plan, stored.trialEndsAt), storedPlan: stored.plan }
  const features = workspaceFeaturesOf(enabledFeatures)

  const memberOnly = !!args.memberOnly
  const [staffUsers, member, employerLinks, ncAdmin, contacts, partnerContacts] = await Promise.all([
    memberOnly ? [] : db.institutionUser.findMany({
      where: { institutionId: institution.id, userId: args.userId, revokedAt: null, acceptedAt: { not: null } },
      select: { id: true, role: true, workspace: true, unitId: true },
    }),
    db.institutionMember.findFirst({
      where: { institutionId: institution.id, candidate: { userId: args.userId }, status: { not: 'OPTED_OUT' } },
      select: { id: true },
    }),
    memberOnly ? [] : db.institutionEmployer.findMany({
      where: {
        institutionId: institution.id,
        status: 'APPROVED',
        employerProfile: {
          OR: [{ userId: args.userId }, { seats: { some: { userId: args.userId, acceptedAt: { not: null } } } }],
        },
      },
      select: { employerProfileId: true },
    }),
    memberOnly ? false : isNcAdmin(args.userId, args.email, db, args.aal ?? null),
    // A person at a member company with a role (hiring, outplacement). One indexed lookup, a few narrow rows.
    memberOnly
      ? []
      : db.memberCompanyContact.findMany({
          where: { institutionId: institution.id, userId: args.userId, acceptedAt: { not: null } },
          select: { roles: true, memberCompanyId: true, memberCompany: { select: { employerProfileId: true } } },
          take: 5,
        }),
    // A person at a confirmed ecosystem partner. One indexed lookup; access ends when the partner is no longer confirmed.
    memberOnly
      ? []
      : db.ecosystemPartnerContact.findMany({
          where: { institutionId: institution.id, userId: args.userId, acceptedAt: { not: null }, partner: { status: 'CONFIRMED' } },
          select: { partnerId: true },
          take: 5,
        }),
  ])

  const own = new Set<AccessToken>()
  for (const s of staffUsers) {
    if (s.role === 'VIEWER') {
      if (s.workspace) own.add(`VIEWER:${s.workspace}`)
    } else {
      own.add(s.role)
    }
  }
  if (member) own.add('MEMBER')
  if (employerLinks.length) own.add('EMPLOYER')
  if (partnerContacts.length) own.add('PARTNER')
  for (const c of contacts) for (const r of c.roles) if ((EMPLOYER_ROLES as readonly string[]).includes(r.toLowerCase())) own.add(`EMPLOYER:${r.toLowerCase() as EmployerRole}`)
  // A hiring contact acts through the company's connected hiring login (intros, jobs it posts).
  const contactProfiles = contacts.filter((c) => c.roles.includes('HIRING') && c.memberCompany.employerProfileId).map((c) => c.memberCompany.employerProfileId!)

  let tokens: ReadonlySet<AccessToken> = own
  let mode: InstitutionAccess['mode'] = 'own'
  let demoPersona: string | null = null

  if (ncAdmin && institution.isDemo) {
    // Demo tenant: nc_admin sees every workspace, no View-as logging.
    demoPersona = args.demoPersona ?? 'all'
    tokens = demoPersonaTokens(demoPersona)
    mode = 'demo-admin'
  } else if (ncAdmin && args.email) {
    // Real tenant: only inside a View-as the admin started (and logged with
    // a reason) within the last hour.
    const now = args.now ?? new Date()
    const viewAs = await db.adminAccessLog.findFirst({
      where: {
        adminEmail: args.email,
        viewedInstitutionId: institution.id,
        surface: VIEW_AS_SURFACE,
        viewedAt: { gte: new Date(now.getTime() - VIEW_AS_TTL_MS) },
      },
      select: { id: true },
    })
    if (viewAs) {
      tokens = new Set<AccessToken>([...ALL_TOKENS, ...own])
      mode = 'view-as'
    }
  }

  // Staff whose every seat is limited to a school or department (owner decision 2026-11-18): they see only those units'
  // alumni, under the units' own plan (paid when any of their units is paid). Someone with a seat for the whole
  // institution, and NextChapter staff in a demo or View-as, see the whole institution.
  let units: UnitScope[] | null = null
  if (mode === 'own' && staffUsers.length > 0 && staffUsers.every((s) => s.unitId)) {
    const rows = await db.institutionUnit.findMany({ where: { id: { in: staffUsers.map((s) => s.unitId!) }, institutionId: institution.id }, select: { id: true, name: true, school: true, department: true, plan: true } })
    units = rows.map(({ plan: _p, ...u }) => u)
    institution.plan = rows.some((r) => r.plan === 'PAID') ? 'PAID' : 'FREE'
    // A paid unit also opens Development (owner decision 2026-11-18): at least the Advancement tier, scoped to its alumni.
    if (institution.plan === 'PAID' && institution.tier === 'CAREER') institution.tier = 'ADVANCEMENT'
  }

  return {
    institution,
    userId: args.userId,
    email: args.email,
    ownTokens: own,
    units,
    tokens,
    workspaces: mode === 'demo-admin' ? workspacesForStart(workspacesFor(tokens, institution.tier, features, orgKindOf(institution.orgType)), args.demoStart) : workspacesFor(tokens, institution.tier, features, orgKindOf(institution.orgType)),
    demoStart: mode === 'demo-admin' ? (args.demoStart ?? null) : null,
    isNcAdmin: ncAdmin,
    mode,
    demoPersona,
    staffUsers,
    // On a demo, previewing as an alum acts as the seeded featured alum.
    memberId: member?.id ?? (mode === 'demo-admin' ? await demoFeaturedMember(db, institution, args.demoAlum) : null),
    employerProfileIds: [...new Set([...employerLinks.map((l) => l.employerProfileId), ...contactProfiles])],
    memberCompanyIds: contacts.map((c) => c.memberCompanyId),
    partnerIds: tokens.has('PARTNER') && partnerContacts.length === 0 ? await demoConfirmedPartners(db, institution) : partnerContacts.map((c) => c.partnerId),
  }
}

export class WorkspaceAccessError extends Error {}

// For the reader functions: does this context hold any of these roles?
export function holds(ctx: Pick<InstitutionAccess, 'tokens'>, roles: AccessToken[]): boolean {
  return roles.some((r) => ctx.tokens.has(r))
}

// A guest pass to a demo: every workspace the demo has, read-only, no user.
export async function resolveDemoGuestAccess(args: { slug: string; demoPersona?: string | null; demoAlum?: string | null; demoStart?: string | null }, db: Db = prisma): Promise<InstitutionAccess | null> {
  const row = await db.institution.findUnique({
    where: { slug: args.slug },
    select: { id: true, slug: true, name: true, programBrandName: true, logoUrl: true, accentColor: true, isDemo: true, tier: true, plan: true, orgType: true, enabledFeatures: true, isSampleData: true },
  })
  if (!row || !row.isDemo || !row.isSampleData) return null
  const { enabledFeatures, isSampleData: _s, ...institution } = row
  const features = workspaceFeaturesOf(enabledFeatures)
  const demoPersona = args.demoPersona ?? 'all'
  const tokens = demoPersonaTokens(demoPersona)
  return {
    institution,
    userId: `demo-guest:${institution.slug}`,
    email: null,
    ownTokens: new Set<AccessToken>(),
    tokens,
    workspaces: workspacesForStart(workspacesFor(tokens, institution.tier, features, orgKindOf(institution.orgType)), args.demoStart),
    demoStart: args.demoStart ?? null,
    isNcAdmin: false,
    mode: 'demo-guest',
    demoPersona,
    staffUsers: [],
    memberId: tokens.has('MEMBER') ? await demoFeaturedMember(db, institution, args.demoAlum) : null,
    employerProfileIds: [],
    partnerIds: tokens.has('PARTNER') ? await demoConfirmedPartners(db, institution) : [],
  }
}
