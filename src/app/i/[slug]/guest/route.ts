import { NextResponse, type NextRequest } from 'next/server'
import { openDemo } from '@/lib/higher-ed/open-demo'
import { DEMO_GUEST_COOKIE, DEMO_GUEST_DAYS, guestCookieValue, guestSlugs } from '@/lib/higher-ed/demo-guest'
import { ORG_SUBDOMAINS_ON, orgAppPath } from '@/lib/org-hosts'
import { orgHostKindOf } from '@/lib/higher-ed/workspaces'
import { captureServerEvent } from '@/lib/posthog/server'
import { fillDemoIfEmpty } from '@/lib/higher-ed/demo-fill'

export const dynamic = 'force-dynamic'
// The first visit to an empty demo fills it (about a minute, once).
export const maxDuration = 300

// The public way into a curated demo college (owner rule 2026-11-18: a demo opens without a login, or comes with credentials
// to share). The fixtures in DEMO_TENANTS (CMU and the like) and the demos NextChapter staff build (One Louisville) open this
// way, only while the row is a demo of sample data: fictional people, read-only (openDemo). Prospect-made demos keep their
// signed link (./[token]).
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const inst = await openDemo(slug)
  if (!inst) return NextResponse.redirect(new URL(ORG_SUBDOMAINS_ON ? '/demo' : '/demo/workforce', request.url), 307)
  // A placeholder demo with no people yet is filled now rather than at the next nightly run.
  await fillDemoIfEmpty(slug, 'public_link').catch((err) => console.error('[demo-guest] fill', slug, err))
  const kind = orgHostKindOf(inst.orgType)
  const res = NextResponse.redirect(new URL(orgAppPath(slug, kind, kind === 'workforce' ? '/hub' : ''), request.url), 307)
  const mine = guestSlugs(request.cookies.get(DEMO_GUEST_COOKIE)?.value)
  res.cookies.set(DEMO_GUEST_COOKIE, guestCookieValue([...mine, slug]), { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: DEMO_GUEST_DAYS * 86_400 })
  captureServerEvent(`demo:${slug}`, 'demo_public_link_opened', { slug, institutionId: inst.id, returning: mine.includes(slug) })
  return res
}
