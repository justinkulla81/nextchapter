'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { adminTransferClient } from '@/lib/coach/reassignment'
import { captureServerEvent } from '@/lib/posthog/server'

export async function toggleCoachTestAccount(coachId: string, current: boolean): Promise<void> {
  await requireAdmin()

  await prisma.coach.update({
    where: { id: coachId },
    data: { isSampleData: !current },
  })

  revalidatePath('/support/admin/coaches')
  revalidatePath(`/support/admin/coaches/${coachId}`)
}

// §A5.4 surge-capacity bench — admin flags a coach as on-call/retainer.
export async function toggleCoachBench(coachId: string, current: boolean): Promise<void> {
  const admin = await requireAdmin()

  await prisma.coach.update({
    where: { id: coachId },
    data: { isOnCallBench: !current },
  })

  captureServerEvent(admin?.email ?? 'admin', 'coach_bench_status_toggled', { coachId, isOnCallBench: !current })

  revalidatePath('/support/admin/coaches')
  revalidatePath(`/support/admin/coaches/${coachId}`)
}

export type TransferClientFormState = { error?: string } | undefined

// §A5.4 coach-departure handoff — admin transfers one client from this coach
// to another in one step, generating the §A5.1-backed handoff summary (see
// adminTransferClient).
export async function transferClient(
  coachId: string,
  candidateId: string,
  _prevState: TransferClientFormState,
  formData: FormData
): Promise<TransferClientFormState> {
  const admin = await requireAdmin()

  const toCoachId = formData.get('toCoachId') as string | null
  if (!toCoachId) return { error: 'Choose a coach to transfer this client to.' }
  if (toCoachId === coachId) return { error: 'Choose a different coach.' }

  const reason = (formData.get('reason') as string | null)?.trim() || null

  await adminTransferClient({
    candidateId,
    fromCoachId: coachId,
    toCoachId,
    reason,
    actor: admin?.email ?? 'admin',
  })

  revalidatePath(`/support/admin/coaches/${coachId}`)
  revalidatePath(`/support/admin/coaches/${toCoachId}`)
  revalidatePath(`/support/admin/candidates/${candidateId}`)
}
