'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentHiringManager } from '@/lib/hiring/current-hiring-manager'
import { createReq, updateReqStatus } from '@/lib/hiring/reqs'
import { captureServerEvent } from '@/lib/posthog/server'
import type { HiringReqStatus } from '@prisma/client'

export type ReqActionState = { error?: string } | undefined

export async function createReqAction(_prevState: ReqActionState, formData: FormData): Promise<ReqActionState> {
  const hiringManager = await getCurrentHiringManager()
  const title = (formData.get('title') as string | null) ?? ''

  const result = await createReq(hiringManager.id, title)
  if (result.error) return { error: result.error }

  captureServerEvent(hiringManager.id, 'hiring_req_created', { reqId: result.reqId })
  revalidatePath('/hiring/reqs')
  return {}
}

export async function updateReqStatusAction(reqId: string, status: HiringReqStatus): Promise<void> {
  const hiringManager = await getCurrentHiringManager()
  const result = await updateReqStatus(reqId, hiringManager.id, status)
  if (result.error) {
    console.error('updateReqStatusAction error:', result.error)
    return
  }
  captureServerEvent(hiringManager.id, 'hiring_req_status_changed', { reqId, status })
  revalidatePath('/hiring/reqs')
}
