import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { recordCandidateLoginIfDue } from '@/lib/auth/record-login'

// Called client-side right after a successful sign-in (LoginForm,
// CallbackHandler) — auth itself happens via the browser Supabase SDK with
// no server round-trip, so without this there's no point where a login
// event is ever recorded. Server-side because the real IP/user-agent live
// on the request headers here, not in the browser JS that triggered the
// sign-in. No-ops for non-candidate accounts (coach/recruiter/employer/admin
// logins share this same LoginForm) since CandidateLoginEvent only tracks
// candidate app usage.
//
// Shares recordCandidateLoginIfDue with getDashboardData's after() callback
// rather than inserting directly — this route fires client-side right before
// navigating to /dashboard, so its request routinely races the dashboard
// SSR's own login-recording call. Two independent unguarded inserts for the
// same real login produced back-to-back duplicate rows; routing both callers
// through the same dedupe-checked helper collapses them to one.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const candidate = await prisma.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (!candidate) return NextResponse.json({ ok: true })

  const [ip, h] = await Promise.all([getClientIp(), headers()])
  await recordCandidateLoginIfDue(candidate.id, ip, h.get('user-agent'))

  return NextResponse.json({ ok: true })
}
