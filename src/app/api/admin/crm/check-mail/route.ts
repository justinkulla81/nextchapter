import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { backfillPersonFromEmail } from '@/lib/crm/sync'
import { CRM_ACTIVITY_CUTOFF } from '@/lib/crm/cutoff'
import { getValidAccessToken } from '@/lib/google/connection'
import { olderCorrespondence } from '@/lib/google/gmail'
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
    // Nothing since the cutoff is not the same as never having written. Say
    // which it is — one list call, no message bodies.
    let older: { count: number; newestAt: string | null } | null = null
    if (result.found === 0) {
      const token = await getValidAccessToken()
      if (token) {
        const o = await olderCorrespondence(token, email, CRM_ACTIVITY_CUTOFF).catch(() => null)
        if (o && o.count > 0) older = { count: o.count, newestAt: o.newestAt?.toISOString() ?? null }
      }
    }
    return NextResponse.json({ ok: true, found: result.found, older, failed: result.failed ?? 0 })
  } catch (e) {
    captureServerEvent(admin.email ?? 'admin', 'crm_email_backfill_failed', {
      personId, error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json({ ok: false, message: 'Could not check mail just now.' })
  }
}
