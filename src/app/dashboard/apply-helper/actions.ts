'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { issueConnectCode } from '@/lib/apply-helper/token'
import { captureServerEvent } from '@/lib/posthog/server'

export async function getConnectCode(): Promise<{ ok: true; code: string; expires: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session ended. Sign in again, then try once more.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  const { code, expiresAt } = issueConnectCode(profile.id)
  captureServerEvent(profile.id, 'apply_helper_code_created', {})
  return { ok: true, code, expires: expiresAt.toISOString().slice(0, 10) }
}
