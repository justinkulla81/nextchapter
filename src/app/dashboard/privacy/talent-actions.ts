'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { disconnectIntakeConnection, saveIntakeConsent } from '@/lib/recruiter/intake/consent'

export type MyRecruitersState = { error?: string; success?: string } | undefined

// Only the candidate who owns the claimed intake profile can change it.
async function ownedConnection(connectionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.intakeConnection.findFirst({
    where: { id: connectionId, disconnectedAt: null, intakeCandidate: { candidate: { userId: user.id } } },
  })
}

async function clientIp() {
  return (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function updateFirmSharing(_prev: MyRecruitersState, formData: FormData): Promise<MyRecruitersState> {
  const connection = await ownedConnection(String(formData.get('connectionId') ?? ''))
  if (!connection) return { error: 'Could not find that connection. Refresh and try again.' }
  await saveIntakeConsent(connection.id, formData.getAll('consent').map(String), await clientIp())
  revalidatePath('/dashboard/privacy')
  return { success: 'Saved.' }
}

export async function disconnectFromFirm(connectionId: string) {
  const connection = await ownedConnection(connectionId)
  if (!connection) return
  await disconnectIntakeConnection(connection.id, await clientIp())
  revalidatePath('/dashboard/privacy')
}
