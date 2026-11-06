import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { previewMatchCounts } from '@/lib/onboarding/match-preview'
import type { Answers, QuestionId } from '@/lib/onboarding/bundles'

// The live job count under the aiming and where questions. A route, not a server action: Next runs a client's server
// actions one at a time, so a slow count used to hold up the member's Continue. No profile is created here.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const READ: QuestionId[] = ['function', 'level', 'targetRole', 'place', 'workSetup', 'relocation']
const EMPTY = { baseline: null, now: null }

// Whether this server instance has answered a count before (the first one pays for loading the job board).
let warm = false

export async function POST(request: Request) {
  const started = Date.now()
  const noStore = { headers: { 'Cache-Control': 'no-store' } }
  try {
    const body = (await request.json()) as { bundle?: unknown; answers?: unknown; withBaseline?: unknown }
    if (body.bundle !== 'aiming' && body.bundle !== 'where') return NextResponse.json(EMPTY, { status: 400, ...noStore })
    const sent = body.answers && typeof body.answers === 'object' ? (body.answers as Record<string, unknown>) : {}
    const answers: Answers = {}
    for (const id of READ) {
      const v = sent[id]
      if (typeof v === 'string') answers[id] = v.trim().slice(0, 200)
    }

    const user = await getCurrentUser()
    if (!user) return NextResponse.json(EMPTY, { status: 401, ...noStore })
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id } })
    if (!profile) return NextResponse.json(EMPTY, { status: 404, ...noStore })

    const cold = !warm
    const result = await previewMatchCounts(profile, body.bundle, answers, body.withBaseline === true)
    warm = true
    captureServerEvent(profile.id, 'onboarding_match_preview', {
      candidateId: profile.id,
      bundle: body.bundle,
      durationMs: Date.now() - started,
      cached: result.cached,
      coldInstance: cold,
      withBaseline: body.withBaseline === true,
      matches: result.now,
    })
    return NextResponse.json({ baseline: result.baseline, now: result.now }, noStore)
  } catch (error) {
    console.error('Onboarding job count failed:', error)
    return NextResponse.json(EMPTY, { status: 500, ...noStore })
  }
}
