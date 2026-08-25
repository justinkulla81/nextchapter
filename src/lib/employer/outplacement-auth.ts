import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { OutplacementRole } from '@prisma/client'

// Partners Master Build Script §A7 — the four-role RBAC for the employer
// (outplacement-buyer) portal. Distinct from the global RoleGrant ledger,
// which only records "this identity holds employer_admin somewhere" for
// RoleContextBanner purposes — OutplacementOrgUser is what every
// employer-portal query/action actually authorizes against, and it scopes
// WHICH buying org (see prisma/schema.prisma's own comment on the model).
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
    include: { org: { select: { id: true, name: true, programBrandName: true } } },
  })
  // No self-serve signup for this portal (see src/app/employer/signup —
  // outplacement is a contract-sold product, not sign-up-and-go) — a
  // logged-in identity with no OutplacementOrgUser row has nowhere to land
  // but the explainer.
  if (!orgUser) redirect('/employer/signup')

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
    include: { org: { select: { id: true, name: true, programBrandName: true } } },
  })
  if (!orgUser || !allowed.includes(orgUser.role)) return null

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
