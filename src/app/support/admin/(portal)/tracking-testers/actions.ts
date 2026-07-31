'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

const PATH = '/support/admin/tracking-testers'

export async function setCandidateTester(candidateId: string, enabled: boolean) {
  await requireAdmin()
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { gmailTrackingTesterEnabled: enabled },
  })
  revalidatePath(PATH)
}

export async function addManualTesterEmail(formData: FormData) {
  const admin = await requireAdmin()
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  if (!email) return

  await prisma.trackingTesterAllowlistEntry.upsert({
    where: { email },
    create: { email, addedBy: admin.email ?? null },
    update: {},
  })
  revalidatePath(PATH)
}

export async function removeManualTesterEmail(email: string) {
  await requireAdmin()
  await prisma.trackingTesterAllowlistEntry.delete({ where: { email } }).catch(() => {})
  revalidatePath(PATH)
}
