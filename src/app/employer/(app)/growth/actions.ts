'use server'

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireEmployeesRoleForAction } from '@/lib/employer/outplacement-auth'
import { closeInternalRole, createInternalRole, orgProgramTypes, readInternalRole } from '@/lib/employer/staff-programs'

export type StaffFormState = { error?: string; ok?: string } | undefined

async function growthAdmin() {
  const orgUser = await requireEmployeesRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'Only an admin on this account can manage internal roles.' } as const
  if (!(await orgProgramTypes(orgUser.orgId)).has('GROWTH')) return { error: 'Internal roles come with a Growth program. Ask your NextChapter contact to add one.' } as const
  return { orgUser } as const
}

export async function addInternalRole(_prev: StaffFormState, f: FormData): Promise<StaffFormState> {
  const g = await growthAdmin()
  if ('error' in g) return { error: g.error }
  const input = readInternalRole(f)
  if ('error' in input) return { error: input.error }
  const role = await createInternalRole(g.orgUser.orgId, g.orgUser.orgName, g.orgUser.email ?? g.orgUser.userId, input)
  captureServerEvent(g.orgUser.userId, 'internal_role_posted', { orgId: g.orgUser.orgId, postingId: role.id, hasApplyLink: !!input.applyUrl })
  revalidatePath('/employer/growth')
  return { ok: `${input.title} is posted. Your enrolled employees see it under Roles at your company.` }
}

export async function setInternalRoleOpen(postingId: string, open: boolean): Promise<{ error?: string }> {
  const g = await growthAdmin()
  if ('error' in g) return { error: g.error }
  const ok = await closeInternalRole(g.orgUser.orgId, postingId, open)
  if (!ok) return { error: 'That role is no longer here. Refresh the page.' }
  captureServerEvent(g.orgUser.userId, open ? 'internal_role_reopened' : 'internal_role_closed', { orgId: g.orgUser.orgId, postingId })
  revalidatePath('/employer/growth')
  return {}
}
