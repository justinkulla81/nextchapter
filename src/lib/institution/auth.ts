import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { InstitutionUserRole } from '@prisma/client'
import { can, type InstitutionCapability } from '@/lib/institution/permissions'

// The signed-in college staff member and the ONE institution they belong to. Every
// institution-portal page and action resolves the institution from here, never from a
// URL or form field, so one college's staff can never read or change another's.
export interface CurrentInstitutionUser {
  id: string
  userId: string
  email: string | null
  fullName: string | null
  role: InstitutionUserRole
  institutionId: string
  institutionName: string
  programBrandName: string | null
}

async function lookup(): Promise<CurrentInstitutionUser | null> {
  const supabase = await createClient('institution')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const row = await prisma.institutionUser.findFirst({
    where: { userId: user.id, revokedAt: null, acceptedAt: { not: null } },
    include: { institution: { select: { id: true, name: true, programBrandName: true } } },
    orderBy: { acceptedAt: 'asc' },
  })
  if (!row) return null
  return {
    id: row.id,
    userId: user.id,
    email: user.email ?? null,
    fullName: row.fullName,
    role: row.role,
    institutionId: row.institution.id,
    institutionName: row.institution.name,
    programBrandName: row.institution.programBrandName,
  }
}

export async function getCurrentInstitutionUser(): Promise<CurrentInstitutionUser> {
  const u = await lookup()
  if (!u) redirect('/institution/login')
  return u
}

/** For Server Actions: null instead of redirecting when the person may not do this. */
export async function requireInstitutionCapabilityForAction(
  capability: InstitutionCapability
): Promise<CurrentInstitutionUser | null> {
  const u = await lookup()
  return u && can(u.role, capability) ? u : null
}
