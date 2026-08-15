'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { hasMarketIntelligenceAccess } from '@/lib/market-intelligence/access'
import { generateWeeklyBrief } from '@/lib/market-intelligence/weekly-brief'

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

// Premium-gated LLM generation — see this phase's report for the real,
// metered LLM cost this introduces (one claude-sonnet-5 call per click,
// capped at 500 output tokens, thinking disabled). Re-checked server-side
// even though the page itself already hides the button below Premium, so
// this can never be triggered by a direct form post from a non-Premium
// account. Plain `<form action={...}>` (no useActionState) since there's no
// user-facing error path once the page's own gate already hides the button
// — a disallowed/logged-out post is a no-op, not a user-visible error.
export async function generateWeeklyBriefAction(): Promise<void> {
  const profile = await getProfile()
  if (!profile) return

  const allowed = await hasMarketIntelligenceAccess(profile.id, 'weekly_brief')
  if (!allowed) return

  await generateWeeklyBrief(profile.id)
  captureServerEvent(profile.id, 'market_intel_weekly_brief_generated', { candidateId: profile.id })
  revalidatePath('/dashboard/market-intelligence')
}
