import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { readClickUrl } from '@/lib/job-search-daily/click-link'

// A tracked link in the Job Search Daily email. Records the click against
// the send (first click time, count, last link) and redirects. Never blocks
// the redirect on a database failure; a bad signature goes to the homepage.
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const parsed = readClickUrl(request.nextUrl.searchParams)
  if (!parsed) return NextResponse.redirect(new URL('/', appUrl))

  try {
    const send = await prisma.jobSearchDailySend.findUnique({ where: { id: parsed.sendId }, select: { id: true, candidateId: true, clickedAt: true } })
    if (send) {
      await prisma.jobSearchDailySend.update({
        where: { id: send.id },
        data: { clickedAt: send.clickedAt ?? new Date(), clickCount: { increment: 1 }, lastClickLink: parsed.url.slice(0, 500) },
      })
      captureServerEvent(send.candidateId, 'job_search_daily_clicked', { sendId: send.id, link: parsed.url })
    }
  } catch (error) {
    console.error('Failed to record Job Search Daily click:', error)
  }
  return NextResponse.redirect(parsed.url)
}
