'use server'

import { revalidatePath } from 'next/cache'
import { requireOutplacementRoleForAction } from '@/lib/employer/outplacement-auth'
import { inviteOrgUser } from '@/lib/employer/outplacement-org-users'
import type { OutplacementRole } from '@prisma/client'

export type InviteOrgUserState = { error?: string; sent?: boolean } | undefined

export async function inviteOrgUserAction(
  _prevState: InviteOrgUserState,
  formData: FormData
): Promise<InviteOrgUserState> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'You need employer_admin access to invite teammates.' }

  const email = (formData.get('email') as string | null) ?? ''
  const fullName = (formData.get('fullName') as string | null)?.trim() || null
  const role = formData.get('role') as OutplacementRole | null
  if (!role) return { error: 'Choose a role.' }

  const result = await inviteOrgUser(orgUser, email, role, fullName)
  if (result.error) return result

  revalidatePath('/employer/team')
  return { sent: true }
}
