'use server'

import { revalidatePath } from 'next/cache'
import { requireOutplacementRoleForAction } from '@/lib/employer/outplacement-auth'
import { enrollSingleSeat, enrollBulkCsv, type EnrollSingleResult, type EnrollBulkResult } from '@/lib/employer/outplacement-enrollment'

export async function enrollSingleAction(
  _prevState: EnrollSingleResult | undefined,
  formData: FormData
): Promise<EnrollSingleResult> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'You need employer_admin access to enroll someone.' }

  const contractId = (formData.get('contractId') as string | null) ?? ''
  const email = (formData.get('email') as string | null) ?? ''
  const name = (formData.get('name') as string | null) ?? ''
  if (!contractId) return { error: 'Choose a contract to enroll into.' }

  const result = await enrollSingleSeat(orgUser, contractId, email, name || null)
  if (!result.error) revalidatePath('/employer/roster')
  return result
}

export async function enrollBulkAction(
  _prevState: EnrollBulkResult | undefined,
  formData: FormData
): Promise<EnrollBulkResult> {
  const orgUser = await requireOutplacementRoleForAction(['ADMIN'])
  if (!orgUser) return { error: 'You need employer_admin access to enroll people.', invited: 0, linked: 0, failed: 0, rowErrors: [] }

  const contractId = (formData.get('contractId') as string | null) ?? ''
  const file = formData.get('file') as File | null
  if (!contractId) return { error: 'Choose a contract to enroll into.', invited: 0, linked: 0, failed: 0, rowErrors: [] }
  if (!file || file.size === 0) return { error: 'Choose a CSV file to upload.', invited: 0, linked: 0, failed: 0, rowErrors: [] }

  const csvText = await file.text()
  const result = await enrollBulkCsv(orgUser, contractId, csvText)
  if (!result.error) revalidatePath('/employer/roster')
  return result
}
