import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { isMemberEmail, jobPath } from '@/lib/leads/member-job-link'

const KINDS = new Set(['job_alert', 'layoff_alert', 'deadline_reminders'])

/** A link in an alert email: counts the click, then opens the job page (?j=) or layoff page (?to=) on our site. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rawJob = request.nextUrl.searchParams.get('j') ?? ''
  const jobId = /^[A-Za-z0-9_-]{1,60}$/.test(rawJob) ? rawJob : ''
  // Only a layoff company page on this site; anything else falls back to the jobs list.
  const rawTo = request.nextUrl.searchParams.get('to') ?? ''
  const layoffPath = /^\/layoffs\/company\/[a-z0-9-]{1,80}$/.test(rawTo) ? rawTo : ''
  let member = false
  try {
    const lead = await prisma.homepageLead.findUnique({ where: { unsubscribeToken: token }, select: { email: true, kind: true } })
    if (lead && KINDS.has(lead.kind)) captureServerEvent(lead.email, 'alert_clicked', { kind: lead.kind, jobId, to: layoffPath })
    if (lead && jobId) member = await isMemberEmail(lead.email)
  } catch (error) {
    console.error('alert click failed:', error instanceof Error ? error.message : error)
  }
  const dest = layoffPath ? `${layoffPath}?from=alert` : jobId ? jobPath(jobId, member, 'alert') : '/jobs'
  return NextResponse.redirect(new URL(dest, request.url))
}
