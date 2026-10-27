import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { parseKitLabel } from '@/lib/cohorts/launch-kit'
import { parseKitLabelAny } from '@/lib/org-claims/org-kit'
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE_SECONDS } from '@/lib/candidates/referral'
import { safeNext } from '@/lib/auth/safe-next'

// A referral link: /api/r/<code>. Remembers who sent the visitor (30-day
// cookie, read at registration by applyReferralCookie) and lands them on
// the homepage — or ?to=/some/path on this site. An unknown or switched-off
// code still redirects, so a stale link is never a dead end.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const to = request.nextUrl.searchParams.get('to')
  // safeNext, not a startsWith('//') check: "/\evil.com" parses as
  // https://evil.com in new URL(), so that check let ?to= leave the site.
  const path = safeNext(to, '/')
  const response = NextResponse.redirect(new URL(path, appUrl))

  const link = await prisma.referralLink.findUnique({ where: { code }, select: { id: true, isActive: true, label: true } })
  if (link?.isActive) {
    response.cookies.set(REFERRAL_COOKIE, code, {
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS, httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production',
    })
    const kit = parseKitLabel(link.label)
    if (kit) captureServerEvent(`kit:${kit.cohortId}`, 'cohort_kit_link_clicked', { cohortId: kit.cohortId, source: kit.source })
    const orgKit = parseKitLabelAny(link.label)
    if (orgKit) captureServerEvent(`org-kit:${orgKit.kind}:${orgKit.id}`, 'org_kit_link_clicked', { kind: orgKit.kind, orgId: orgKit.id, source: orgKit.source })
    await prisma.referralLink.update({ where: { id: link.id }, data: { clickCount: { increment: 1 } } }).catch(() => {})
  }
  return response
}
