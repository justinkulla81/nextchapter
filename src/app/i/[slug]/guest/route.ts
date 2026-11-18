import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEMO_GUEST_COOKIE, DEMO_GUEST_DAYS, guestCookieValue, guestSlugs } from '@/lib/higher-ed/demo-guest'
import { DEMO_TENANTS } from '@/lib/higher-ed/demo-tenants'
import { ORG_SUBDOMAINS_ON, orgAppPath } from '@/lib/org-hosts'
import { orgHostKindOf } from '@/lib/higher-ed/workspaces'
import { captureServerEvent } from '@/lib/posthog/server'

export const dynamic = 'force-dynamic'

// The public way into a curated demo college (owner rule 2026-11-18: a demo opens without a login, or comes with credentials
// to share). Only the fixtures in DEMO_TENANTS (CMU and the like) open this way, and only while the row is a demo of sample
// data: fictional people, read-only. Prospect-made demos keep their signed link (./[token]).
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const inst = DEMO_TENANTS[slug] ? await prisma.institution.findFirst({ where: { slug, isDemo: true, isSampleData: true }, select: { id: true, orgType: true } }) : null
  if (!inst) return NextResponse.redirect(new URL(ORG_SUBDOMAINS_ON ? '/demo' : '/demo/workforce', request.url), 307)
  const kind = orgHostKindOf(inst.orgType)
  const res = NextResponse.redirect(new URL(orgAppPath(slug, kind, kind === 'workforce' ? '/hub' : ''), request.url), 307)
  const mine = guestSlugs(request.cookies.get(DEMO_GUEST_COOKIE)?.value)
  res.cookies.set(DEMO_GUEST_COOKIE, guestCookieValue([...mine, slug]), { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: DEMO_GUEST_DAYS * 86_400 })
  captureServerEvent(`demo:${slug}`, 'demo_public_link_opened', { slug, institutionId: inst.id, returning: mine.includes(slug) })
  return res
}
