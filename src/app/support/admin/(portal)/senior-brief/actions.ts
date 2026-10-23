'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { sendSeniorBriefTest } from '@/lib/email/dispatch/run-senior-brief'
import { captureServerEvent } from '@/lib/posthog/server'

export type TestSendState = { ok: boolean; message: string } | null

/** Sends the real brief for one real senior member to the admin address only. Writes nothing to the member's Gmail. */
export async function sendTestBrief(_prev: TestSendState, formData: FormData): Promise<TestSendState> {
  await requireAdmin()
  const memberId = String(formData.get('memberId') ?? '').trim() || undefined
  const result = await sendSeniorBriefTest(memberId)
  captureServerEvent('admin', 'senior_brief_test_sent', { ok: result.ok, memberId: memberId ?? null })
  revalidatePath('/support/admin/senior-brief')
  return result
}
