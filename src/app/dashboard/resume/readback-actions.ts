'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { memberIndustryBuckets } from '@/lib/profile/industry-reading'
import { clearResumePrefillMarks } from '@/lib/resume/clear-prefill-marks'
import { readbackFacts, type ReadbackFact } from '@/lib/personalization/resume-readback'

async function profileOrNull() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? getOrCreateCandidateProfile(user.id) : null
}

/** What the profile now says, from the résumé just uploaded (resume-readback.ts). */
export async function loadResumeReadback(): Promise<ReadbackFact[] | null> {
  const p = await profileOrNull()
  if (!p) return null
  return readbackFacts({ ...p, industries: memberIndustryBuckets(p) })
}

/** "Looks right": confirms every fact shown — their "from your résumé" marks are cleared. */
export async function confirmResumeReadback(): Promise<{ ok: boolean; facts: number }> {
  const p = await profileOrNull()
  if (!p) return { ok: false, facts: 0 }
  const facts = readbackFacts({ ...p, industries: memberIndustryBuckets(p) })
  await clearResumePrefillMarks(p.id, [...new Set(facts.flatMap((f) => f.fields))])
  captureServerEvent(p.id, 'resume_readback_confirmed', { facts: facts.length, keys: facts.map((f) => f.key), fromResume: facts.filter((f) => f.fromResume).length })
  return { ok: true, facts: facts.length }
}
