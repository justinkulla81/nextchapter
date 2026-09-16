import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

  return NextResponse.redirect(link.originalUrl)
}
