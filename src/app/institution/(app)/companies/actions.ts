'use server'

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '@/lib/posthog/server'
import { flagTargetCompany, unflagTargetCompany } from '@/lib/companies/institution-targets'
import { requireInstitutionCapabilityForAction } from '@/lib/institution/auth'

export type TargetState = { error?: string } | undefined

export async function addTargetCompany(_prev: TargetState, formData: FormData): Promise<TargetState> {
  const user = await requireInstitutionCapabilityForAction('manage_target_companies')
  if (!user) return { error: 'You do not have access to change target companies.' }
  const result = await flagTargetCompany({
    institutionId: user.institutionId,
    companyName: (formData.get('companyName') as string | null)?.trim() ?? '',
    note: (formData.get('note') as string | null)?.trim() || null,
    createdBy: user.email,
  })
  if ('error' in result) return { error: result.error }
  captureServerEvent(user.userId, 'institution_target_company_added', { institutionId: user.institutionId })
  revalidatePath('/institution/companies')
}

export async function removeTargetCompany(companyId: string): Promise<void> {
  const user = await requireInstitutionCapabilityForAction('manage_target_companies')
  if (!user) return
  await unflagTargetCompany(user.institutionId, companyId)
  captureServerEvent(user.userId, 'institution_target_company_removed', { institutionId: user.institutionId })
  revalidatePath('/institution/companies')
}
