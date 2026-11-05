import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { withEmailAttribution } from '@/lib/marketing/email-attribution'

/**
 * Public by necessity — this URL is embedded in an email delivered to an
 * arbitrary mail client, which will never carry an admin session. The link
 * id itself (a cuid) is the only credential, same as any other email
 * tracking link; it authorizes nothing beyond "redirect to this one URL and
 * count it."
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await params
  const link = await prisma.crmOutreachLink.findUnique({ where: { id: linkId } })
  if (!link) return NextResponse.redirect('https://launchyournextchapter.com')

  const now = new Date()
  await prisma.crmOutreachLink.update({
    where: { id: linkId },
    data: {
      clickCount: { increment: 1 },
      firstClickedAt: link.firstClickedAt ?? now,
      lastClickedAt: now,
    },
  })

  // The nudge emails (lifecycle, nurture, pick-up) get a PostHog event so click-through can be read by step next to the funnel.
  // Best effort: a lookup failure never delays the redirect.
  try {
    const row = await prisma.crmOutreachLink.findUnique({ where: { id: linkId }, select: { tracking: { select: { activity: { select: { sourceRef: true } } } } } })
    const [kind, step] = (row?.tracking?.activity?.sourceRef ?? '').split(':')
    if (kind === 'lifecycle' || kind === 'nurture' || kind === 'onboarding') captureServerEvent(`email-link:${linkId}`, 'nudge_email_clicked', { linkId, kind, step: step ?? null })
  } catch {
    // ignore
  }

  // A link to our own site carries this link's id into the landing URL, so the visitor log can name the recipient.
  return NextResponse.redirect(withEmailAttribution(link.originalUrl, linkId))
}
