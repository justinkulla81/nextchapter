import { after, NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { fileErrorReport } from '@/lib/help/auto-report'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'

export const maxDuration = 30

// The error screen's "Tell us" button posts here. Signed-in members only: it files a Problem in the Help inbox for them
// (lib/help/auto-report.ts). Everyone else gets 401 and the screen shows a contact link instead.
export async function POST(request: NextRequest) {
  if (!(await allowByIp('error-report', 20, HOUR_MS))) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  const text = await request.text().catch(() => '')
  if (!text || text.length > 2048) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'signed_out' }, { status: 401 })
  const profile = await getOrCreateCandidateProfile(user.id)

  const result = await fileErrorReport(profile.id, { path: body.path, digest: body.digest, title: body.title, userAgent: request.headers.get('user-agent') }, (work) => after(work))
  captureServerEvent(profile.id, 'page_error_reported', { requestId: result.requestId, duplicate: result.duplicate, page: typeof body.path === 'string' ? body.path.slice(0, 300) : null, digest: typeof body.digest === 'string' ? body.digest.slice(0, 80) : null })
  return NextResponse.json({ ok: true, requestId: result.requestId })
}
