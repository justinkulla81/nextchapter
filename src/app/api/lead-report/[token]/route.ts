import { NextResponse, type NextRequest } from 'next/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { isMailScanner, setLeadCookie } from '@/lib/leads/lifecycle/prefill'
import { REPORT_EDITIONS, latestReport, reportPath } from '@/lib/reports'

/**
 * The report link in the newsletter welcome. Counts the click for the address in the signed token, remembers the address so a
 * sign-up from the report has it filled in, then opens that edition (the latest when the slug is not a real edition). A bad token
 * still opens the report.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const search = request.nextUrl.searchParams
  const edition = REPORT_EDITIONS.find((e) => e.slug === search.get('r')) ?? latestReport()
  const step = (search.get('step') ?? 'welcome').slice(0, 20)
  const dest = new URL(edition ? reportPath(edition) : '/reports', request.url)
  dest.search = new URLSearchParams({ utm_source: 'lead_email', utm_campaign: `newsletter_${step}`, utm_content: 'report' }).toString()
  const response = NextResponse.redirect(dest)

  let who: ReturnType<typeof readUnsubscribeToken> = null
  try {
    who = readUnsubscribeToken(token)
  } catch {
    who = null
  }
  if (who) {
    setLeadCookie(response, token)
    if (!isMailScanner(request.headers.get('user-agent'))) captureServerEvent(who.email, 'lead_email_report_clicked', { report: edition?.slug ?? null, step, variant: 'newsletter' })
  }
  return response
}
