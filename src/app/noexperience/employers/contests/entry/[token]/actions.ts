'use server'

import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export async function markCrucibleContestEntryOpened(token: string): Promise<void> {
  const entry = await prisma.crucibleContestEntry.findUnique({ where: { token } })
  if (!entry || entry.openedAt) return

  await prisma.crucibleContestEntry.update({ where: { id: entry.id }, data: { openedAt: new Date() } })
  captureServerEvent(entry.sessionId, 'crucible_contest_link_opened', { contestId: entry.contestId })
}

export type SubmitEntryState = { error?: string; success?: boolean } | undefined

export async function submitCrucibleContestEntry(
  token: string,
  _prevState: SubmitEntryState,
  formData: FormData
): Promise<SubmitEntryState> {
  const submission = (formData.get('submission') as string | null)?.trim()
  if (!submission) return { error: 'Please write something before submitting.' }

  const entry = await prisma.crucibleContestEntry.findUnique({ where: { token }, include: { contest: true } })
  if (!entry) return { error: "This link isn't valid." }
  if (entry.contest.state !== 'OPEN') return { error: 'This contest is no longer accepting entries.' }

  const isResubmission = entry.status === 'SUBMITTED'

  await prisma.crucibleContestEntry.update({
    where: { id: entry.id },
    data: { submission, submittedAt: new Date(), status: 'SUBMITTED' },
  })

  captureServerEvent(entry.sessionId, 'crucible_contest_entry_submitted', {
    contestId: entry.contestId,
    isResubmission,
  })

  return { success: true }
}
