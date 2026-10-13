import { NextResponse, type NextRequest } from 'next/server'
import { clearEndedGrace } from '@/lib/higher-ed/transition'
import { captureServerEvent } from '@/lib/posthog/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 120

// Higher Ed nightly (spec §6.3): flags whose post-placement grace has ended
// clear (fundraising may ask again), and where the alum said the college
// helped, the gratitude ask goes to Development for approval. Idempotent.
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const startedAt = new Date()
  const result = await clearEndedGrace(startedAt)
  captureServerEvent('cron', 'he_nightly_ran', { ...result, ms: Date.now() - startedAt.getTime() })
  return NextResponse.json({ ok: true, ...result })
}
