import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

/** The unsubscribe link in every newsletter email. Works without signing in. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const sub = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token }, select: { id: true, email: true, unsubscribedAt: true } })
  if (sub && !sub.unsubscribedAt) {
    await prisma.newsletterSubscriber.update({ where: { id: sub.id }, data: { unsubscribedAt: new Date() } })
    captureServerEvent(sub.email, 'newsletter_unsubscribed', {})
  }
  // The same confirmation whether or not the link matched anyone, so it never
  // errors in front of a reader and never confirms an address exists.
  return new NextResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;"><p>You won't receive the NextChapter weekly email anymore.</p><p><a href="https://launchyournextchapter.com">Back to NextChapter</a></p></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
}
