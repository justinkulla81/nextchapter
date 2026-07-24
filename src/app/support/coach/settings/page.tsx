import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Session-based entry point for a logged-in coach — resolves their row by
// userId and hands off to the existing token-based settings editor (branding
// + Coaching Onboarding Form), so "URLs that make sense" doesn't require
// forking that already-built UI into a second, session-derived copy.
export default async function CoachSettingsEntryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const coach = await prisma.coach.findUnique({ where: { userId: user.id } })
  if (!coach) redirect('/support/coach/signup')

  redirect(`/support/coach/settings/${coach.accessToken}`)
}
