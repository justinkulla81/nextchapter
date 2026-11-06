import { NextResponse } from 'next/server'
import { getSessionIdentity } from '@/lib/supabase/get-current-user'
import { warmSharedBoard } from '@/lib/jobs/board-shortlist'
import { captureServerEvent } from '@/lib/posthog/server'

// Called by the résumé step while a file is chosen, uploaded and read: it loads the job board into this server
// instance so the job count on the next steps is not the first thing to pay for it. Needs a session (anonymous is
// fine), does no per-member work and returns nothing the page uses. One load at a time per instance, and at most one
// a minute, however often it is called.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MIN_GAP_MS = 60_000
let lastStart = 0
// Whether this instance has loaded the board before (the first load is the cold one).
let warmedOnce = false
let running: Promise<void> | null = null

export async function POST() {
  const noStore = { headers: { 'Cache-Control': 'no-store' } }
  const session = await getSessionIdentity()
  if (!session) return new NextResponse(null, { status: 401, ...noStore })

  if (!running && Date.now() - lastStart >= MIN_GAP_MS) {
    lastStart = Date.now()
    const started = Date.now()
    const first = !warmedOnce
    running = warmSharedBoard()
      .then(() => {
        captureServerEvent(session.id, 'onboarding_board_warmed', { durationMs: Date.now() - started, coldInstance: first })
        warmedOnce = true
      })
      .catch((error) => console.error('Onboarding board warm-up failed:', error))
      .finally(() => {
        running = null
      })
  }
  // Waits for a load already running (so a second tab does not return early), never starts more than one.
  if (running) await running
  return new NextResponse(null, { status: 204, ...noStore })
}

