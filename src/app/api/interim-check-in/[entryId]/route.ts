import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyLink } from '@/lib/email/signed-links'
import { confirmPage, messagePage } from '@/lib/http/confirm-page'

const REVERIFY_INTERVAL_DAYS = 30
// Check-in emails go monthly; unsigned links from before signing are honoured
// until the last of them would have been replaced by a signed one.
const LEGACY_UNSIGNED_UNTIL = Date.parse('2026-12-13T00:00:00Z')

function authorize(request: NextRequest, entryId: string, response: string | null): boolean {
  const sig = request.nextUrl.searchParams.get('sig')
  if (sig) return verifyLink(sig, 'interim-check-in', entryId, response === 'ended' ? 'ended' : 'active')
  return Date.now() < LEGACY_UNSIGNED_UNTIL
}

const INVALID = "This link isn't valid anymore. You can update your work history from your NextChapter dashboard."

// GET only asks for confirmation: "ended" rewrites a work-history row, and
// mail scanners fetch every link in an email.
export async function GET(request: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params
  const response = request.nextUrl.searchParams.get('response')
  if (!authorize(request, entryId, response)) return messagePage(INVALID, 410)

  const entry = await prisma.workHistoryEntry.findUnique({ where: { id: entryId }, select: { id: true } })
  if (!entry) return messagePage("This link isn't valid.")

  return confirmPage({
    message: response === 'ended' ? 'Mark this role as ended?' : 'Confirm this role is still current?',
    button: response === 'ended' ? 'Yes, it ended' : 'Yes, still active',
    action: `${request.nextUrl.pathname}${request.nextUrl.search}`,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params
  const response = request.nextUrl.searchParams.get('response')
  if (!authorize(request, entryId, response)) return messagePage(INVALID, 410)

  const entry = await prisma.workHistoryEntry.findUnique({ where: { id: entryId }, select: { id: true } })
  if (!entry) return messagePage("This link isn't valid.")

  await prisma.workHistoryEntry.update({
    where: { id: entryId },
    data:
      response === 'ended'
        ? { isCurrent: false, endDate: new Date(), nextReverifyAt: null }
        : { nextReverifyAt: new Date(Date.now() + REVERIFY_INTERVAL_DAYS * 86400000) },
  })

  return messagePage(
    response === 'ended'
      ? 'Got it — marked as ended. Thanks for keeping this current.'
      : "Got it — we'll check back in about a month.",
  )
}
