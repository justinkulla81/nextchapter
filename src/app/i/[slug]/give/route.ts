import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { recordGiveClick } from '@/lib/higher-ed/gratitude'
import { captureServerEvent } from '@/lib/posthog/server'

// Every "give" link: from the gratitude email (?t=token) or the Give back
// card (signed-in member). Records the click, then hands off to the
// college's own giving page. NextChapter never touches the gift.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const token = request.nextUrl.searchParams.get('t')
  let memberId: string | null = null
  let distinctId = token ? `give:${token.slice(0, 8)}` : 'anonymous'
  if (!token) {
    const user = await getCurrentUser()
    if (user) {
      const m = await prisma.institutionMember.findFirst({
        where: { institution: { slug }, candidate: { userId: user.id }, status: { in: ['CLAIMED', 'ACTIVE'] } },
        select: { id: true },
      })
      memberId = m?.id ?? null
      distinctId = user.id
    }
  }
  const target = await recordGiveClick({ slug, token, memberId })
  captureServerEvent(distinctId, 'he_give_clicked', { slug, source: token ? 'gratitude_email' : 'give_back_card' })
  if (!target) return NextResponse.redirect(new URL(`/i/${slug}`, request.url))
  return NextResponse.redirect(target)
}
