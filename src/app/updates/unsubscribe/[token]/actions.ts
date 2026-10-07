'use server'

import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { unsubscribe } from '@/lib/mailing/lists'

export type UnsubscribeState = { done?: boolean; lists?: string[]; error?: string } | undefined

export async function unsubscribeAction(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const parsed = readUnsubscribeToken(String(formData.get('token') ?? ''))
  if (!parsed) return { error: 'This link is no longer valid. Reply "unsubscribe" to any email and Justin will take you off.' }
  const all = formData.get('scope') === 'all'
  const listIds = formData.getAll('listId').map(String)
  if (!all && listIds.length === 0) return { error: 'Tick at least one list, or choose "Unsubscribe from everything".' }

  const names = await prisma.mailingListMember.findMany({
    where: { email: parsed.email, status: 'ACTIVE', ...(all ? {} : { listId: { in: listIds } }) },
    select: { list: { select: { name: true } } },
  })
  await unsubscribe(parsed.email, all ? 'all' : listIds, 'the unsubscribe page')
  if (parsed.editionId) {
    await prisma.mailingEditionRecipient.updateMany({ where: { editionId: parsed.editionId, email: parsed.email }, data: { unsubscribedAt: new Date() } })
  }
  captureServerEvent(parsed.email, 'mailing_unsubscribed', { via: 'page', all, lists: names.length, editionId: parsed.editionId })
  return { done: true, lists: names.map((n) => n.list.name) }
}
