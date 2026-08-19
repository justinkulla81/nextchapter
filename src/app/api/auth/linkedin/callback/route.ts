import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { exchangeCodeForTokens, fetchLinkedInPersonUrn, isLinkedInPostingConfigured } from '@/lib/linkedin/oauth'
import { prisma } from '@/lib/prisma'

// See start/route.ts — this route is real but unreachable until
// LINKEDIN_CLIENT_ID/SECRET are configured (never true in this environment
// today).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/dashboard/marketing-plan?linkedinError=not_logged_in', request.url))
  }
  if (!isLinkedInPostingConfigured()) {
    return NextResponse.redirect(new URL('/dashboard/marketing-plan?linkedinError=not_configured', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  if (error || !code) {
    return NextResponse.redirect(new URL('/dashboard/marketing-plan?linkedinError=denied', request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const personUrn = await fetchLinkedInPersonUrn(tokens.access_token)
    const profile = await getOrCreateCandidateProfile(user.id)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    await prisma.linkedInConnection.upsert({
      where: { candidateId: profile.id },
      create: {
        candidateId: profile.id,
        accessToken: tokens.access_token,
        personUrn,
        expiresAt,
      },
      update: {
        accessToken: tokens.access_token,
        personUrn,
        expiresAt,
        disconnectedAt: null,
      },
    })

    return NextResponse.redirect(new URL('/dashboard?linkedinConnected=1', request.url))
  } catch (err) {
    console.error('LinkedIn OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/dashboard/marketing-plan?linkedinError=exchange_failed', request.url))
  }
}
