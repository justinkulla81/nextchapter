'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

// "I've seen this and I'm not engaging" — clears it from the open list.
export async function acknowledgeScamAlert(alertId: string): Promise<{ error?: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }
  const result = await prisma.scamAlert.updateMany({
    where: { id: alertId, candidateId: profile.id, acknowledgedAt: null, markedLegitAt: null },
    data: { acknowledgedAt: new Date() },
  })
  if (result.count > 0) captureServerEvent(profile.id, 'scam_alert_acknowledged', { alertId })
  revalidatePath('/dashboard/scam-watch')
  return {}
}

// The candidate verified the recruiter another way and says the flag was
// wrong. Kept (not deleted) so the rule that misfired can be found.
export async function markScamAlertLegit(alertId: string): Promise<{ error?: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }
  const alert = await prisma.scamAlert.findFirst({
    where: { id: alertId, candidateId: profile.id, markedLegitAt: null },
    select: { id: true, level: true, score: true, claimedCompany: true, signals: true },
  })
  if (!alert) return {}
  await prisma.scamAlert.update({ where: { id: alert.id }, data: { markedLegitAt: new Date() } })
  captureServerEvent(profile.id, 'scam_alert_marked_legit', {
    alertId,
    level: alert.level,
    score: alert.score,
    claimedCompany: alert.claimedCompany,
    signalCodes: Array.isArray(alert.signals) ? (alert.signals as { code?: string }[]).map((s) => s.code) : [],
  })
  revalidatePath('/dashboard/scam-watch')
  return {}
}
