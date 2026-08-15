'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { createOutplacementOrg, createOutplacementContract, inviteFirstOrgAdmin } from '@/lib/admin/outplacement-contracts'
import type { OutplacementTier } from '@prisma/client'

export type ActionState = { error?: string; success?: string } | undefined

export async function createOrgAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()

  const name = (formData.get('name') as string | null)?.trim()
  const programBrandName = (formData.get('programBrandName') as string | null)?.trim() || null
  const primaryContactName = (formData.get('primaryContactName') as string | null)?.trim() || null
  const primaryContactEmail = (formData.get('primaryContactEmail') as string | null)?.trim().toLowerCase()
  const isSampleData = formData.get('isSampleData') === 'on'

  if (!name) return { error: 'Enter an organization name.' }
  if (!primaryContactEmail || !primaryContactEmail.includes('@')) return { error: 'Enter a valid primary contact email.' }

  await createOutplacementOrg({ name, programBrandName, primaryContactName, primaryContactEmail, isSampleData })
  revalidatePath('/support/admin/outplacement-contracts')
  return { success: `${name} created.` }
}

export async function createContractAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()

  const orgId = (formData.get('orgId') as string | null) ?? ''
  const cohortLabel = (formData.get('cohortLabel') as string | null)?.trim() || null
  const tier = formData.get('tier') as OutplacementTier | null
  const seatCount = Number(formData.get('seatCount'))
  const termStartAt = formData.get('termStartAt') as string | null
  const termEndAt = formData.get('termEndAt') as string | null
  const poReference = (formData.get('poReference') as string | null)?.trim() || null
  const invoiceReference = (formData.get('invoiceReference') as string | null)?.trim() || null
  const isSampleData = formData.get('isSampleData') === 'on'

  if (!orgId) return { error: 'Choose an organization.' }
  if (!tier) return { error: 'Choose a tier.' }
  if (!Number.isFinite(seatCount) || seatCount < 1) return { error: 'Enter a valid seat count.' }
  if (!termStartAt || !termEndAt) return { error: 'Enter a term start and end date.' }

  await createOutplacementContract(admin.id, {
    orgId,
    cohortLabel,
    tier,
    seatCount,
    termStartAt: new Date(termStartAt),
    termEndAt: new Date(termEndAt),
    poReference,
    invoiceReference,
    isSampleData,
  })
  revalidatePath('/support/admin/outplacement-contracts')
  return { success: 'Contract created.' }
}

export async function inviteFirstAdminAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()

  const orgId = (formData.get('orgId') as string | null) ?? ''
  const email = (formData.get('email') as string | null) ?? ''
  const fullName = (formData.get('fullName') as string | null)?.trim() || null
  if (!orgId) return { error: 'Choose an organization.' }

  const result = await inviteFirstOrgAdmin(admin.id, orgId, email, fullName)
  if (result.error) return result

  revalidatePath('/support/admin/outplacement-contracts')
  return { success: `Invite sent to ${email}.` }
}
