import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getPersona } from '@/lib/constants/personas'

/** "Which is closest to you?" after confirming, and the next-step button in every alert. Saves the choice, then opens /start/<situation>. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const persona = getPersona(request.nextUrl.searchParams.get('p') ?? '')
  const via = request.nextUrl.searchParams.get('via') === 'email' ? 'email' : 'confirm_page'
  const slug = persona?.slug ?? 'thinking-about-a-move'
  try {
    const lead = await prisma.homepageLead.findUnique({ where: { unsubscribeToken: token }, select: { id: true, email: true, kind: true } })
    if (lead && lead.kind === 'job_alert') {
      await prisma.homepageLead.update({ where: { id: lead.id }, data: { journeySlug: slug } })
      captureServerEvent(lead.email, 'onboarding_started_from_alert', { situation: slug, via })
    }
  } catch (error) {
    console.error('job alert journey failed:', error instanceof Error ? error.message : error)
  }
  return NextResponse.redirect(new URL(`/start/${slug}?from=job_alert`, request.url))
}
