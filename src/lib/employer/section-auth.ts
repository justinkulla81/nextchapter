import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLegacyGrants, getWorkspaceGrants, type AccessSource, type EmployerAccessDb, type SectionGrant } from '@/lib/employer/access'
import { cookieOwnerForSection } from '@/lib/employer/section-links'
import { firstAllowed } from '@/lib/employer/section-roles'
import { employerSection, type EmployerSectionKey } from '@/lib/employer/sections'

// requireSectionRole: the per-section role gate (docs/specs/employer-sections-build-plan.md, 6).
//
// Order matters and is the safety rule of this whole change: today's checks are asked FIRST (getLegacyGrants: the same
// EmployerProfile / EmployerSeat / OutplacementOrgUser lookups the pages have always used). The new OrgWorkspaceAdmin
// table is asked ONLY when the legacy answer does not already allow the role, and only ever adds access. If the new table
// cannot be read, the answer is today's answer. Nothing here changes a session, a cookie or a login.

export interface SectionMember {
  userId: string
  email: string | null
  section: EmployerSectionKey
  role: string
  source: AccessSource
  /** OutplacementEmployerOrg id (Employees, Outplacement) or EmployerProfile id (Hiring). Null when a workspace is not linked to one yet. */
  recordId: string | null
  organizationId?: string
  workspaceId?: string
}

export type SectionDenied = 'signed_out' | 'wrong_role' | 'other_sections' | 'holds_nothing'

export type SectionResolution = { ok: true; member: SectionMember } | { ok: false; reason: SectionDenied }

function toMember(userId: string, email: string | null, g: SectionGrant): SectionMember {
  return { userId, email, section: g.section, role: g.role, source: g.source, recordId: g.recordId, organizationId: g.organizationId, workspaceId: g.workspaceId }
}

/** Pure given the two lookups: legacy first, new table only if legacy does not already allow it. */
export async function resolveSectionMember(
  section: EmployerSectionKey,
  allowed: readonly string[],
  who: { userId: string; email: string | null },
  db?: EmployerAccessDb
): Promise<SectionResolution> {
  const legacy = await getLegacyGrants(who, db)
  const legacyHit = firstAllowed(legacy.filter((g) => g.section === section), allowed)
  if (legacyHit) return { ok: true, member: toMember(who.userId, who.email, legacyHit) }

  const { grants: added } = await getWorkspaceGrants(who, db)
  const addedHit = firstAllowed(added.filter((g) => g.section === section), allowed)
  if (addedHit) return { ok: true, member: toMember(who.userId, who.email, addedHit) }

  const all = [...legacy, ...added]
  if (all.some((g) => g.section === section)) return { ok: false, reason: 'wrong_role' }
  return { ok: false, reason: all.length ? 'other_sections' : 'holds_nothing' }
}

/** Where a denied person goes. Someone who holds another section is sent to the chooser, not to a dead end. */
export function deniedRedirect(section: EmployerSectionKey, reason: SectionDenied): string {
  const info = employerSection(section)
  if (reason === 'signed_out') return info.signInPath
  if (reason === 'wrong_role') return info.homePath
  if (reason === 'other_sections') return '/employer-home'
  return section === 'hiring' ? '/talent/signup' : '/employer/signup'
}

async function signedInUser(section: EmployerSectionKey): Promise<{ userId: string; email: string | null } | null> {
  const supabase = await createClient(cookieOwnerForSection(section))
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { userId: user.id, email: user.email ?? null } : null
}

/** For pages and layouts: redirects when the person may not be here. */
export async function requireSectionRole(section: EmployerSectionKey, allowed: readonly string[]): Promise<SectionMember> {
  const who = await signedInUser(section)
  if (!who) redirect(deniedRedirect(section, 'signed_out'))
  const r = await resolveSectionMember(section, allowed, who)
  if (!r.ok) redirect(deniedRedirect(section, r.reason))
  return r.member
}

/** For Server Actions, which cannot redirect: null when the person may not do this. */
export async function requireSectionRoleForAction(section: EmployerSectionKey, allowed: readonly string[]): Promise<SectionMember | null> {
  const who = await signedInUser(section)
  if (!who) return null
  const r = await resolveSectionMember(section, allowed, who)
  return r.ok ? r.member : null
}
