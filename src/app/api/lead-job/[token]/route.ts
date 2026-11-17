import { NextResponse, type NextRequest } from 'next/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { isMailScanner, setLeadCookie } from '@/lib/leads/lifecycle/prefill'

const JOB_ID = /^[a-z0-9]{10,40}$/i

/**
 * A job in a lifecycle email ("Three more jobs like this one"). Counts the click for the address in the signed token, remembers
 * the address so a sign-up from the job page has it filled in, then opens the job's page. A bad token still opens the job.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const search = request.nextUrl.searchParams
  const jobId = search.get('job') ?? ''
  if (!JOB_ID.test(jobId)) return NextResponse.redirect(new URL('/jobs', request.url))
  const step = (search.get('step') ?? 'welcome').slice(0, 20)
  const position = Number(search.get('pos')) || null

  const dest = new URL(`/jobs/${jobId}`, request.url)
  dest.search = new URLSearchParams({ from: 'lead_email', utm_source: 'lead_email', utm_campaign: `applied_job_${step}`, utm_content: 'similar_job' }).toString()
  const response = NextResponse.redirect(dest)

  let who: ReturnType<typeof readUnsubscribeToken> = null
  try {
    who = readUnsubscribeToken(token)
  } catch {
    who = null
  }
  if (who) {
    setLeadCookie(response, token)
    if (!isMailScanner(request.headers.get('user-agent'))) captureServerEvent(who.email, 'lead_email_job_clicked', { jobId, step, position, variant: 'applied_job' })
  }
  return response
}
