import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { readParseState } from '@/lib/resume/parse-state'
import { parseView } from '@/lib/resume/parse-view'

// Polled by the résumé progress screen. Says only whether the reading is still going, so the page can reload
// once it has ended (done, failed or rejected); the page itself decides what to show.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ status: 'none' })
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { journeyDetails: true } })
  const view = parseView(readParseState(profile?.journeyDetails))
  return NextResponse.json({ status: view.kind === 'processing' ? 'processing' : 'ended' })
}
