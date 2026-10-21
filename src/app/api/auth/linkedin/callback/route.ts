import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { exchangeCodeForTokens, fetchLinkedInPersonUrn, isLinkedInPostingConfigured } from '@/lib/linkedin/oauth'
import { prisma } from '@/lib/prisma'
import { ADMIN_HOST } from '@/proxy'
import { verifyAdminLinkedInState } from '@/lib/linkedin/admin-state'
import { fetchAdministeredPages, fetchLinkedInProfile, pickNextChapterPage } from '@/lib/linkedin/oauth'
import { encryptToken } from '@/lib/security/token-crypto'

// The admin's "Connect LinkedIn" lands here too (the one redirect URL the
// LinkedIn app has registered). A request carrying a valid signed admin state
// is the admin's; everything else is the candidate flow below, unchanged.
async function adminConnect(request: NextRequest, adminEmail: string): Promise<NextResponse> {
  const back = (q: string) => NextResponse.redirect(new URL(`/support/admin/linkedin-drafts?linkedin=${q}`, `https://${ADMIN_HOST}`))
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  // LinkedIn refuses a scope the app has no product for before it ever asks the member.
  if (error === 'unauthorized_scope_error') return back('needs_product')
  if (error || !code) return back('denied')
  try {
    const tokens = await exchangeCodeForTokens(code, { admin: true })
    const { personUrn, name } = await fetchLinkedInProfile(tokens.access_token)
    // Posts go out as the company page. The member must administer it, which the page list shows.
    const pages = await fetchAdministeredPages(tokens.access_token).catch((e) => { console.error('LinkedIn page list failed:', e); return null })
    if (pages === null) return back('needs_product')
    if (pages.length === 0) return back('no_page')
    const page = pickNextChapterPage(pages)
    if (!page) return back('which_page')
    const data = {
      accessToken: encryptToken(tokens.access_token), personUrn, memberName: name, organizationUrn: page.urn, organizationName: page.name,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000), connectedAt: new Date(), disconnectedAt: null,
    }
    await prisma.linkedInAdminConnection.upsert({ where: { adminEmail }, create: { adminEmail, ...data }, update: data })
    return back('connected')
  } catch (err) {
    console.error('LinkedIn admin connect failed:', err)
    return back('exchange_failed')
  }
}

// See start/route.ts — this route is real but unreachable until
// LINKEDIN_CLIENT_ID/SECRET are configured (never true in this environment
// today).
export async function GET(request: NextRequest) {
  const adminState = verifyAdminLinkedInState(request.nextUrl.searchParams.get('state'))
  if (adminState && isLinkedInPostingConfigured()) return adminConnect(request, adminState.adminEmail)

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
