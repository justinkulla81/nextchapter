'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { logCatalogAction } from '@/lib/weekly/sprint'

function todayKeyUTC(): string {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

// Prompt 70 — fired from OutboundPartnerLink's onClick. Identity comes from
// the authenticated session, never from a client-supplied candidateId.
// Always captures the PostHog event; only awards points and inserts a
// PartnerClickThrough row the first time a given candidate clicks a given
// partner on a given UTC day — the unique constraint on
// (candidateId, partnerName, dayKey) is what actually enforces the cap.
export async function logPartnerClickThrough(partnerName: string, section: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  captureServerEvent(profile.id, 'partner_link_clicked', { partnerName, section })

  const dayKey = todayKeyUTC()
  const result = await prisma.partnerClickThrough.createMany({
    data: [{ candidateId: profile.id, partnerName, section, dayKey }],
    skipDuplicates: true,
  })

  if (result.count > 0) {
    const effort = estimateActionEffort({ actionType: 'PARTNER_CLICK_THROUGH' })
    await logCatalogAction(profile.id, {
      text: `Clicked through to ${partnerName}`,
      actionType: 'PARTNER_CLICK_THROUGH',
      points: effort.points,
      estimatedMinutes: effort.minutes,
      recurring: false,
    })
    captureServerEvent(profile.id, 'partner_click_through_points_awarded', {
      partnerName,
      section,
      points: effort.points,
    })
    revalidatePath('/dashboard', 'layout')
  }
}
