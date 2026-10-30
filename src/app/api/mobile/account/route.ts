import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { mobileUser } from '@/lib/mobile/auth'
import { notifyAdminOfHelp, notifyAdminOfPortalHelp } from '@/lib/help/notify'

// Account deletion started from the app (App Store guideline 5.1.1(v), Google Play account-deletion rule). Needs the password again
// and the word DELETE. It deactivates the account the same way the website's Danger zone does (nothing is erased in this request),
// removes the app's devices and saved searches, and opens a Help inbox request so permanent deletion is finished by a person.
const REQUEST_TEXT = 'Account deletion request from the NextChapter app. The member deactivated their account and asked for it, and all of their data, to be permanently deleted.'

export async function POST(request: NextRequest) {
  if (!(await allowByIp('mobile-account-delete', 10, HOUR_MS))) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  const user = await mobileUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = (await request.json().catch(() => null)) as { password?: unknown; confirm?: unknown } | null
  if (typeof b?.confirm !== 'string' || b.confirm.trim().toUpperCase() !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })
  if (typeof b.password !== 'string' || !b.password || !user.email) return NextResponse.json({ error: 'Enter your password to confirm.' }, { status: 400 })

  // A fresh sign-in proves it is the account holder, not just someone holding a phone with a saved session.
  const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: pwError } = await check.auth.signInWithPassword({ email: user.email, password: b.password })
  if (pwError) return NextResponse.json({ error: 'That password is not right.' }, { status: 403 })

  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
    await prisma.mobileSavedSearch.deleteMany({ where: { userId: user.id } })
    await prisma.mobileDevice.deleteMany({ where: { userId: user.id } })
    if (profile) await prisma.candidateProfile.update({ where: { id: profile.id }, data: { deactivatedAt: new Date() } })
    const help = await prisma.helpRequest.create({
      data: {
        candidateId: profile?.id ?? null,
        requesterEmail: profile ? null : user.email,
        kind: 'HELP',
        subject: 'Account deletion request (mobile app)',
        contextPath: '/api/mobile/account',
        messages: { create: { body: REQUEST_TEXT } },
      },
    })
    if (profile) await notifyAdminOfHelp(help.id, REQUEST_TEXT, false)
    else await notifyAdminOfPortalHelp(help.id, REQUEST_TEXT)
    captureServerEvent(profile?.id ?? user.id, 'mobile_account_deletion_requested', { helpRequestId: help.id, hadProfile: !!profile })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('mobile account deletion failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not complete this right now. Email support@launchyournextchapter.com and we will do it.' }, { status: 503 })
  }
}
