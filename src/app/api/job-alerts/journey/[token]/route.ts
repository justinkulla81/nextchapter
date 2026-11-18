import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getPersona } from '@/lib/constants/personas'
import { makeUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { profileDestination, setLeadCookie } from '@/lib/leads/lifecycle/prefill'

/**
 * A situation button: "Which is closest to you?" on the alert confirmation page and the tools, and the next-step button in alert
 * emails. Opens the first onboarding question with the situation filled in (it used to stop at /start/<situation>, a page that asked
 * them to click on to the same question; nobody who picked one by 2026-11-18 registered) and remembers the address for the details
 * step. A tap on a page is their own answer: saved, and sent on for them. An email button carries our guess from their search: filled
 * in for them to confirm, and not saved over an answer they gave.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const persona = getPersona(request.nextUrl.searchParams.get('p') ?? '')
  const via = request.nextUrl.searchParams.get('via') === 'email' ? 'email' : 'confirm_page'
  const slug = persona?.slug ?? 'thinking-about-a-move'
  let picked = via === 'confirm_page'
  let email: string | null = null
  try {
    const lead = await prisma.homepageLead.findUnique({ where: { unsubscribeToken: token }, select: { id: true, email: true, kind: true, journeySlug: true } })
    if (lead && ['job_alert', 'layoff_alert', 'pay_check', 'resume_check', 'deadline_reminders'].includes(lead.kind)) {
      email = lead.email
      // An email button is their answer only when it is the one they already gave.
      if (!picked && lead.journeySlug === slug) picked = true
      if (picked && lead.journeySlug !== slug) await prisma.homepageLead.update({ where: { id: lead.id }, data: { journeySlug: slug } })
      captureServerEvent(lead.email, 'onboarding_started_from_alert', { situation: slug, via, picked })
    }
  } catch (error) {
    console.error('job alert journey failed:', error instanceof Error ? error.message : error)
  }
  const from = picked ? 'alert_pick' : 'job_alert'
  const dest = profileDestination(slug, new URLSearchParams({ from, utm_source: via === 'email' ? 'alert_email' : 'alert_page', utm_campaign: 'situation' }))
  const response = NextResponse.redirect(new URL(dest, request.url))
  if (email) {
    try {
      setLeadCookie(response, makeUnsubscribeToken(email, null))
    } catch {
      // No signing secret: the details step just asks for the email.
    }
  }
  return response
}
