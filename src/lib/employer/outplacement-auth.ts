import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getEmployerAccess, getWorkspaceGrants } from '@/lib/employer/access'
import { isSectionRole } from '@/lib/employer/section-roles'
import type { EmployerSectionKey } from '@/lib/employer/sections'
import type { OutplacementRole } from '@prisma/client'

// Partners Master Build Script §A7 — the four-role RBAC for the employer
// (outplacement-buyer) portal. Distinct from the global RoleGrant ledger,
// which only records "this identity holds employer_admin somewhere" for
// RoleContextBanner purposes — OutplacementOrgUser is what every
// employer-portal query/action actually authorizes against, and it scopes
// WHICH buying org (see prisma/schema.prisma's own comment on the model).
//
// Employer sections (docs/specs/employer-sections-build-plan.md): the OutplacementOrgUser lookup below is ALWAYS asked
// first and unchanged. Only when a person has no row there does the new OrgWorkspaceAdmin table get asked, and only for
// a workspace that is ACTIVE and linked to an OutplacementEmployerOrg. It can add access; it never replaces or removes
// the legacy answer, and if it cannot be read the result is the legacy result.
export interface CurrentOutplacementOrgUser {
  id: string
  userId: string
  email: string | null
  role: OutplacementRole
  fullName: string | null
  orgId: string
  orgName: string
  programBrandName: string | null
}

const ORG_SELECT = { id: true, name: true, programBrandName: true } as const

// Fallback only: a person with no OutplacementOrgUser row who is an admin of an ACTIVE section workspace linked to an
// outplacement org. Outplacement takes the four outplacement roles; Employees takes ADMIN and VIEWER (the roles the Growth
// and Learning pages accept). Any failure reads as "no fallback".
async function workspaceMember(userId: string, email: string | null, section: Extract<EmployerSectionKey, 'outplacement' | 'employees'>, allowed?: readonly string[]): Promise<CurrentOutplacementOrgUser | null> {
  try {
    const { grants } = await getWorkspaceGrants({ userId, email })
    const grant = grants.find((g) => g.section === section && g.recordId && isSectionRole(section, g.role) && (section === 'outplacement' || g.role === 'ADMIN' || g.role === 'VIEWER') && (!allowed || allowed.includes(g.role)))
    if (!grant || !grant.recordId) return null
    const org = await prisma.outplacementEmployerOrg.findUnique({ where: { id: grant.recordId }, select: ORG_SELECT })
    if (!org) return null
    return {
      id: `workspace:${grant.workspaceId ?? org.id}`,
      userId,
      email,
      role: grant.role as OutplacementRole,
      fullName: null,
      orgId: org.id,
      orgName: org.name,
      programBrandName: org.programBrandName,
    }
  } catch {
    return null
  }
}

// A signed-in person with no outplacement row. Someone who holds another employer section (Hiring, say) goes to the
// section chooser rather than the "accounts are set up with your contract" explainer, which reads as a lockout to them;
// someone who holds nothing still gets the explainer. A failed lookup keeps today's behavior (the explainer).
async function redirectWithoutRow(userId: string, email: string | null): Promise<never> {
  let holdsAnother = false
  try {
    holdsAnother = (await getEmployerAccess({ userId, email })).sections.length > 0
  } catch {
    holdsAnother = false
  }
  // No self-serve signup for this portal (see src/app/employer/signup —
  // outplacement is a contract-sold product, not sign-up-and-go).
  redirect(holdsAnother ? '/employer-home' : '/employer/signup')
}

function fromRow(
  user: { id: string; email?: string | null },
  orgUser: { id: string; role: OutplacementRole; fullName: string | null; org: { id: string; name: string; programBrandName: string | null } }
): CurrentOutplacementOrgUser {
  return {
    id: orgUser.id,
    userId: user.id,
    email: user.email ?? null,
    role: orgUser.role,
    fullName: orgUser.fullName,
    orgId: orgUser.org.id,
    orgName: orgUser.org.name,
    programBrandName: orgUser.org.programBrandName,
  }
}

// Session-based lookup for pages/layouts — same shape as
// getCurrentRecruiter (src/lib/recruiter/current-recruiter.ts). Redirects
// rather than returning null since every caller is a page/layout that has
// nowhere useful to go without a resolved org user.
export async function getCurrentOutplacementOrgUser(): Promise<CurrentOutplacementOrgUser> {
  const supabase = await createClient('employer')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/employer/login')

  const orgUser = await prisma.outplacementOrgUser.findUnique({
    where: { userId: user.id },
    include: { org: { select: ORG_SELECT } },
  })
  if (orgUser) return fromRow(user, orgUser)

  const fallback = await workspaceMember(user.id, user.email ?? null, 'outplacement')
  if (fallback) return fallback
  return redirectWithoutRow(user.id, user.email ?? null)
}

// The layout around every /employer page. Legacy row first, then an Outplacement workspace admin, then an Employees
// workspace admin (who is shown only the Employees pages, `employeesOnly`).
export async function getCurrentEmployerPortalMember(): Promise<CurrentOutplacementOrgUser & { employeesOnly: boolean }> {
  const supabase = await createClient('employer')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/employer/login')

  const orgUser = await prisma.outplacementOrgUser.findUnique({
    where: { userId: user.id },
    include: { org: { select: ORG_SELECT } },
  })
  if (orgUser) return { ...fromRow(user, orgUser), employeesOnly: false }

  const email = user.email ?? null
  const outplacement = await workspaceMember(user.id, email, 'outplacement')
  if (outplacement) return { ...outplacement, employeesOnly: false }
  const employees = await workspaceMember(user.id, email, 'employees')
  if (employees) return { ...employees, employeesOnly: true }
  return redirectWithoutRow(user.id, email)
}

// Per-page/action role gate — every employer-portal page and Server Action
// that touches enrollment, billing, reporting, or the compliance pack must
// call this (or requireOutplacementRoleForAction below) rather than relying
// on nav items simply not linking to a page (spec §A7 verification: "Enforce
// these for real at the query/action layer, not just hidden nav items").
export async function requireOutplacementRole(
  allowed: OutplacementRole[]
): Promise<CurrentOutplacementOrgUser> {
  const orgUser = await getCurrentOutplacementOrgUser()
  if (!allowed.includes(orgUser.role)) redirect('/employer')
  return orgUser
}

// Action-layer variant — Server Actions can't redirect on a permission
// failure the way a page load can (the form is still mounted on the
// caller's now-stale page), so this returns null instead of redirecting,
// and every action checks for that before doing anything state-changing.
export async function requireOutplacementRoleForAction(
  allowed: OutplacementRole[]
): Promise<CurrentOutplacementOrgUser | null> {
  const supabase = await createClient('employer')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const orgUser = await prisma.outplacementOrgUser.findUnique({
    where: { userId: user.id },
    include: { org: { select: ORG_SELECT } },
  })
  if (orgUser) return allowed.includes(orgUser.role) ? fromRow(user, orgUser) : null

  return workspaceMember(user.id, user.email ?? null, 'outplacement', allowed)
}

// Employees section (Growth and Learning pages). Same legacy-first rule: an OutplacementOrgUser row with an allowed
// role is exactly what these pages have always accepted. Only without one is an Employees workspace admin accepted.
export async function requireEmployeesRole(allowed: Array<'ADMIN' | 'VIEWER'>): Promise<CurrentOutplacementOrgUser> {
  const supabase = await createClient('employer')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/employer/login')

  const orgUser = await prisma.outplacementOrgUser.findUnique({
    where: { userId: user.id },
    include: { org: { select: ORG_SELECT } },
  })
  const email = user.email ?? null
  if (orgUser && allowed.includes(orgUser.role as 'ADMIN' | 'VIEWER')) return fromRow(user, orgUser)
  const fallback = await workspaceMember(user.id, email, 'employees', allowed)
  if (fallback) return fallback
  if (orgUser) redirect('/employer')
  return redirectWithoutRow(user.id, email)
}

export async function requireEmployeesRoleForAction(allowed: Array<'ADMIN' | 'VIEWER'>): Promise<CurrentOutplacementOrgUser | null> {
  const supabase = await createClient('employer')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const orgUser = await prisma.outplacementOrgUser.findUnique({
    where: { userId: user.id },
    include: { org: { select: ORG_SELECT } },
  })
  if (orgUser && allowed.includes(orgUser.role as 'ADMIN' | 'VIEWER')) return fromRow(user, orgUser)
  return workspaceMember(user.id, user.email ?? null, 'employees', allowed)
}
