import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const COOKIE_NAME = 'nc_coach'
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days — long enough to cover a slow signup

// A coach's personal invite link. Sets a short-lived cookie identifying the
// inviting coach, then hands off to the normal candidate onboarding flow —
// read once, at profile creation, by getOrCreateCandidateProfile's caller in
// resume/actions.ts. An existing candidate clicking this link is not
// re-tagged; this only ever applies to a brand-new profile.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  const coach = await prisma.coach.findUnique({ where: { accessToken: token }, select: { id: true } })
  const response = NextResponse.redirect(new URL('/onboarding/resume', appUrl))

  if (coach) {
    response.cookies.set(COOKIE_NAME, coach.id, {
      maxAge: COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  }

  return response
}
