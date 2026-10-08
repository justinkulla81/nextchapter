'use server'

import { revalidatePath } from 'next/cache'
import type { ReferrerKind } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { REFERRER_KINDS, newReferralCode } from '@/lib/candidates/referral'

/** Makes a personal referral link for a CRM person — whoever signs up through it is tagged as recommended by them. */
export async function createReferralLink(personId: string, formData: FormData) {
  const admin = await requireAdmin()
  const kind = String(formData.get('kind') ?? '') as ReferrerKind
  if (!REFERRER_KINDS.includes(kind)) return
  const person = await prisma.crmPerson.findUniqueOrThrow({ where: { id: personId }, select: { fullName: true } })
  const link = await prisma.referralLink.create({
    data: { code: newReferralCode(), label: person.fullName, kind, ownerCrmPersonId: personId, createdBy: admin.email ?? 'admin' },
  })
  captureServerEvent(admin.email ?? 'admin', 'referral_link_created', { kind, linkId: link.id })
  revalidatePath(`/support/admin/crm/people/${personId}`)
}

export async function setReferralLinkActive(personId: string, linkId: string, isActive: boolean) {
  await requireAdmin()
  await prisma.referralLink.updateMany({ where: { id: linkId, ownerCrmPersonId: personId }, data: { isActive } })
  revalidatePath(`/support/admin/crm/people/${personId}`)
}
