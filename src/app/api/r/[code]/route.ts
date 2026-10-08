import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE_SECONDS } from '@/lib/candidates/referral'

// A referral link: /api/r/<code>. Remembers who sent the visitor (30-day
// cookie, read at registration by applyReferralCookie) and lands them on
// the homepage — or ?to=/some/path on this site. An unknown or switched-off
// code still redirects, so a stale link is never a dead end.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const to = request.nextUrl.searchParams.get('to')
  const path = to && to.startsWith('/') && !to.startsWith('//') ? to : '/'
  const response = NextResponse.redirect(new URL(path, appUrl))

  const link = await prisma.referralLink.findUnique({ where: { code }, select: { id: true, isActive: true } })
  if (link?.isActive) {
    response.cookies.set(REFERRAL_COOKIE, code, {
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS, httpOnly: true, sameSite: 'lax', path: '/',
    })
    await prisma.referralLink.update({ where: { id: link.id }, data: { clickCount: { increment: 1 } } }).catch(() => {})
  }
  return response
}
