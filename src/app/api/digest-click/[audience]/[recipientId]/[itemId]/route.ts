import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { DigestAudience } from '@prisma/client'

// Public, unauthenticated redirect — every digest email's nugget link
// points here instead of the raw article URL (see digest-click-url.ts),
// modeled on the existing /api/unsubscribe/audience/[audience]/[id] route's
// polymorphic audience+id addressing. Logs the click (who, what, when) then
// forwards to the real article so the recipient's experience is unchanged
// beyond one redirect hop.
const AUDIENCE_MAP: Record<string, DigestAudience> = {
  candidate: 'CANDIDATE',
  coach: 'COACH',
  recruiter: 'RECRUITER',
  employer: 'EMPLOYER',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ audience: string; recipientId: string; itemId: string }> }
) {
  const { audience, recipientId, itemId } = await params
  const digestAudience = AUDIENCE_MAP[audience]

  const item = await prisma.researchLibraryItem.findUnique({ where: { id: itemId }, select: { url: true } })
  if (!item) {
    return new NextResponse('This link has expired.', { status: 404 })
  }

  if (digestAudience) {
    // Never blocks the redirect — a logging failure shouldn't cost the
    // recipient the article they clicked through to read.
    await prisma.digestClickEvent
      .create({ data: { audience: digestAudience, recipientId, itemId } })
      .catch((error) => console.error('Failed to log digest click:', error))
  }

  return NextResponse.redirect(item.url)
}
