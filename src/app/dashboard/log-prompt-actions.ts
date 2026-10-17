'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { candidatePlusProgress, logOutreachSent } from '@/lib/activity-log/log'
import { isOutreachSource } from '@/lib/activity-log/outreach-note'

export type LogPromptResult = { ok: true; logged: boolean; progress: string } | { ok: false; error: string }

async function candidateId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return (await getOrCreateCandidateProfile(user.id)).id
}

/** "✓ I sent it" after copying an outreach note. Counts toward Candidate+ outreach. */
export async function confirmOutreachSent(input: {
  source: string
  note: string
  jobId?: string | null
  contactId?: string | null
  templateType?: string | null
}): Promise<LogPromptResult> {
  const id = await candidateId()
  if (!id) return { ok: false, error: 'Your session ended. Sign in again, then try once more.' }
  if (!isOutreachSource(input.source) || typeof input.note !== 'string' || !input.note.trim()) {
    return { ok: false, error: 'We couldn’t log that note. Refresh the page and try again.' }
  }
  const result = await logOutreachSent(id, {
    source: input.source,
    note: input.note.slice(0, 20_000),
    jobId: typeof input.jobId === 'string' ? input.jobId.slice(0, 64) : null,
    contactId: typeof input.contactId === 'string' ? input.contactId.slice(0, 64) : null,
    templateType: typeof input.templateType === 'string' ? input.templateType.slice(0, 60) : null,
  })
  if (result.logged) {
    captureServerEvent(id, 'outreach_logged', {
      source: input.source,
      jobId: input.jobId ?? null,
      contactId: input.contactId ?? null,
      companyName: result.companyName,
      contactKind: result.contactKind,
      via: 'sent_prompt',
    })
    revalidatePath('/dashboard', 'layout')
  }
  const progress = await candidatePlusProgress(id, 'outreach')
  return { ok: true, logged: result.logged, progress: progress.line }
}

/** "Not yet" on the sent prompt: nothing is written; the browser re-asks once on the next visit. */
export async function snoozeOutreachPrompt(input: { source: string; jobId?: string | null; reask: boolean }): Promise<void> {
  const id = await candidateId()
  if (!id || !isOutreachSource(input.source)) return
  captureServerEvent(id, 'outreach_prompt_not_yet', { source: input.source, jobId: input.jobId ?? null, reask: !!input.reask })
}
