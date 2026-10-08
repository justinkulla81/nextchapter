import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { unsubscribe } from '@/lib/mailing/lists'

/**
 * RFC 8058 one-click unsubscribe — what Gmail's and Apple Mail's own
 * "Unsubscribe" button posts to (the List-Unsubscribe header). Takes the
 * address off the lists that edition went to. A GET (someone opening the
 * URL) goes to the page with the checkboxes instead.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const parsed = readUnsubscribeToken(token)
  if (!parsed) return NextResponse.json({ ok: true })
  const listIds = parsed.editionId
    ? (await prisma.mailingEditionList.findMany({ where: { editionId: parsed.editionId }, select: { listId: true } })).map((l) => l.listId)
    : []
  const count = await unsubscribe(parsed.email, listIds.length ? listIds : 'all', 'the unsubscribe button in their mail app')
  if (parsed.editionId) {
    await prisma.mailingEditionRecipient.updateMany({ where: { editionId: parsed.editionId, email: parsed.email }, data: { unsubscribedAt: new Date() } })
  }
  captureServerEvent(parsed.email, 'mailing_unsubscribed', { via: 'one_click_header', editionId: parsed.editionId, lists: count })
  return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return NextResponse.redirect(new URL(`/updates/unsubscribe/${token}`, request.url))
}
