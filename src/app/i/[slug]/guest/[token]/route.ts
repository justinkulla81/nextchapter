import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEMO_GUEST_COOKIE, DEMO_GUEST_DAYS, guestCookieValue, guestLinkValid, guestSlugs } from '@/lib/higher-ed/demo-guest'
import { ORG_SUBDOMAINS_ON, orgAppPath } from '@/lib/org-hosts'
import { orgHostKindOf } from '@/lib/higher-ed/workspaces'
import { captureServerEvent } from '@/lib/posthog/server'

export const dynamic = 'force-dynamic'

// A demo's guest link (src/lib/higher-ed/demo-guest.ts): adds this demo to the browser's read-only guest pass and opens
// it. Only a demo (isDemo, sample data) ever opens this way; a bad or expired link goes to the page that builds a demo.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const inst = guestLinkValid(slug, token)
    ? await prisma.institution.findFirst({ where: { slug, isDemo: true, isSampleData: true }, select: { id: true, orgType: true } })
    : null
  if (!inst) return NextResponse.redirect(new URL(`${ORG_SUBDOMAINS_ON ? '/demo' : '/demo/workforce'}?link=expired`, request.url), 307)
  const kind = orgHostKindOf(inst.orgType)
  const res = NextResponse.redirect(new URL(orgAppPath(slug, kind, kind === 'workforce' ? '/hub' : ''), request.url), 307)
  const mine = guestSlugs(request.cookies.get(DEMO_GUEST_COOKIE)?.value)
  res.cookies.set(DEMO_GUEST_COOKIE, guestCookieValue([...mine, slug]), { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: DEMO_GUEST_DAYS * 86_400 })
  captureServerEvent(`demo:${slug}`, 'demo_guest_link_opened', { slug, institutionId: inst.id, returning: mine.includes(slug) })
  return res
}
