import { NextResponse, type NextRequest } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { loadCapturedEmails } from '@/lib/leads/captured-emails'
import { fileLeadInCrm } from '@/lib/leads/lifecycle/file-lead'
import { waitlistVariant } from '@/lib/leads/lifecycle/config'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// One-off catch-up: files every address already captured on the site in the CRM
// (and the website-leads list), oldest first. Sends no email. Safe to run again:
// filing is idempotent. POST { dryRun?: boolean }.
export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await request.json().catch(() => ({}))) as { dryRun?: unknown }
  const dryRun = body.dryRun === true

  const rows = (await loadCapturedEmails(new Date(0))).reverse()
  let filed = 0
  let skipped = 0
  for (const r of rows) {
    if (dryRun) {
      filed++
      continue
    }
    const personId = await fileLeadInCrm({
      email: r.email,
      name: r.name,
      channel: r.channel,
      detail: r.detail,
      journey: r.journey,
      b2b: r.channel === 'Waitlist' && waitlistVariant(r.detail) === 'waitlist_b2b',
      capturedAt: r.capturedAt,
    })
    if (personId) filed++
    else skipped++
  }
  return NextResponse.json({ dryRun, rows: rows.length, filed, skipped })
}
