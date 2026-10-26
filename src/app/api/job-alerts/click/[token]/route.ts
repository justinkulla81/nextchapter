import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

/** A job link in an alert email: counts the click, then opens the job page on our site. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const raw = request.nextUrl.searchParams.get('j') ?? ''
  const jobId = /^[A-Za-z0-9_-]{1,60}$/.test(raw) ? raw : ''
  try {
    const lead = await prisma.homepageLead.findUnique({ where: { unsubscribeToken: token }, select: { email: true, kind: true } })
    if (lead && lead.kind === 'job_alert') captureServerEvent(lead.email, 'alert_clicked', { jobId })
  } catch (error) {
    console.error('job alert click failed:', error instanceof Error ? error.message : error)
  }
  return NextResponse.redirect(new URL(jobId ? `/jobs/${jobId}?from=alert` : '/jobs', request.url))
}
