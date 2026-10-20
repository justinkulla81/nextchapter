import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

/** The unsubscribe link in homepage lead emails (journey plan, saved searches). Works without signing in. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    const lead = await prisma.homepageLead.findUnique({ where: { unsubscribeToken: token }, select: { id: true, email: true, kind: true, unsubscribedAt: true } })
    if (lead && !lead.unsubscribedAt) {
      await prisma.homepageLead.update({ where: { id: lead.id }, data: { unsubscribedAt: new Date() } })
      captureServerEvent(lead.email, 'homepage_lead_unsubscribed', { kind: lead.kind })
    }
  } catch (error) {
    console.error('lead unsubscribe failed:', error instanceof Error ? error.message : error)
  }
  // The same confirmation whether or not the link matched anyone.
  return new NextResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;"><p>You won't get more emails from this signup.</p><p><a href="https://launchyournextchapter.com">Back to NextChapter</a></p></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
}
