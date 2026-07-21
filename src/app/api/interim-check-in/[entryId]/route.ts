import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const REVERIFY_INTERVAL_DAYS = 30

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params
  const response = request.nextUrl.searchParams.get('response')

  const entry = await prisma.workHistoryEntry.findUnique({ where: { id: entryId } })
  if (!entry) {
    return new NextResponse(
      `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;"><p>This link isn't valid.</p></body></html>`,
      { headers: { 'content-type': 'text/html' } }
    )
  }

  const message =
    response === 'ended'
      ? "Got it — marked as ended. Thanks for keeping this current."
      : "Got it — we'll check back in about a month."

  await prisma.workHistoryEntry.update({
    where: { id: entryId },
    data:
      response === 'ended'
        ? { isCurrent: false, endDate: new Date(), nextReverifyAt: null }
        : { nextReverifyAt: new Date(Date.now() + REVERIFY_INTERVAL_DAYS * 86400000) },
  })

  return new NextResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;"><p>${message}</p></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
}
