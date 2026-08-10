import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'

// Called client-side right after a successful sign-in (LoginForm,
// CallbackHandler) — auth itself happens via the browser Supabase SDK with
// no server round-trip, so without this there's no point where a login
// event is ever recorded. Server-side because the real IP/user-agent live
// on the request headers here, not in the browser JS that triggered the
// sign-in. No-ops for non-candidate accounts (coach/recruiter/employer/admin
// logins share this same LoginForm) since CandidateLoginEvent only tracks
// candidate app usage.
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
  await prisma.candidateLoginEvent.create({
    data: { candidateId: candidate.id, ip, userAgent: h.get('user-agent') },
  })

  return NextResponse.json({ ok: true })
}
