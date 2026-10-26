import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { inferJourney } from '@/lib/leads/infer-journey'

/** The confirm link in the first job alert email. Turns alerts on, guesses the journey, then shows the next step. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const to = new URL(`/jobs/alerts/confirmed?t=${encodeURIComponent(token)}`, request.url)
  try {
    const lead = await prisma.homepageLead.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true, email: true, kind: true, searchQ: true, searchLoc: true, confirmedAt: true, journeySlug: true },
    })
    if (lead && lead.kind === 'job_alert' && !lead.confirmedAt) {
      // An answer the same email gave in the journey picker beats a guess from the search words.
      const earlier = await prisma.homepageLead.findFirst({
        where: { email: lead.email, kind: 'journey', unsubscribedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { situation: true },
      })
      const guess = inferJourney({ q: lead.searchQ, loc: lead.searchLoc }, earlier?.situation)
      await prisma.homepageLead.update({ where: { id: lead.id }, data: { confirmedAt: new Date(), unsubscribedAt: null, journeySlug: lead.journeySlug || guess.slug } })
      captureServerEvent(lead.email, 'alert_confirmed', {})
      captureServerEvent(lead.email, 'journey_inferred', { situation: guess.slug, basis: guess.basis })
    }
  } catch (error) {
    console.error('job alert confirm failed:', error instanceof Error ? error.message : error)
  }
  return NextResponse.redirect(to)
}
