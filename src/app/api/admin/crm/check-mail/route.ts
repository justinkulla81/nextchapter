import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { backfillPersonFromEmail } from '@/lib/crm/sync'
import { captureServerEvent } from '@/lib/posthog/server'

// Searching a mailbox for one address is a Google round trip per message; a
// page's server action gets 30 seconds and this needs the cron's budget. Kept
// apart from saving the address so a slow search can never cost the save.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  const { personId, email } = (await req.json().catch(() => ({}))) as { personId?: string; email?: string }
  if (!personId || !email) {
    return NextResponse.json({ ok: false, message: 'Need a person and an address.' }, { status: 400 })
  }

  try {
    const result = await backfillPersonFromEmail(personId, email)
    captureServerEvent(admin.email ?? 'admin', 'crm_email_backfill', {
      personId, found: result.found, reason: result.reason ?? null,
    })
    if (result.reason === 'no_connection' || result.reason === 'no_token') {
      return NextResponse.json({ ok: true, found: 0, message: 'Gmail is not connected.' })
    }
    return NextResponse.json({ ok: true, found: result.found })
  } catch (e) {
    captureServerEvent(admin.email ?? 'admin', 'crm_email_backfill_failed', {
      personId, error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json({ ok: false, message: 'Could not check mail just now.' })
  }
}
