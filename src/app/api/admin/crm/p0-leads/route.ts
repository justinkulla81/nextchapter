import { NextResponse, type NextRequest } from 'next/server'
import { importP0Leads, parseP0Leads } from '@/lib/crm/p0-leads'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 60

const MAX_LEADS = 100

// Write path for the daily digest's rapid-response leads — see
// src/lib/crm/p0-leads.ts for what one lead becomes. Same Bearer key as the
// ncrawl job import: both are local scheduled jobs posting into the admin CRM.
// Re-posting a lead is harmless: each one is keyed on (source link, org,
// person) and a repeat comes back as alreadyLogged without writing anything.
// What this endpoint accepts, so the digest can check before sending fields
// an older deploy would silently ignore (an ignored p0: false would tier the
// contact P0). Bump on any change to the payload.
export function GET() {
  return NextResponse.json({ version: 2, accepts: ['phone', 'p0'] })
}

export async function POST(request: NextRequest) {
  if (!process.env.NC_ATS_API_KEY || request.headers.get('authorization') !== `Bearer ${process.env.NC_ATS_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON: { leads: [...], dryRun?: boolean }' }, { status: 400 })
  }

  const { leads, errors } = parseP0Leads(body)
  if (leads.length > MAX_LEADS) {
    return NextResponse.json({ error: `Send at most ${MAX_LEADS} leads per request` }, { status: 400 })
  }
  const dryRun = (body as { dryRun?: unknown }).dryRun === true
  const results = await importP0Leads(leads, dryRun)

  const written = results.filter((r) => !r.alreadyLogged)
  const summary = {
    received: leads.length + errors.length,
    rejected: errors.length,
    alreadyLogged: results.length - written.length,
    orgsCreated: written.filter((r) => r.org.created).length,
    peopleCreated: written.filter((r) => r.person?.created).length,
    peopleTiered: written.filter((r) => r.person).length,
    possibleDuplicates: written.filter((r) => r.person?.possibleDuplicate).length,
    findContactTasks: written.filter((r) => r.taskId).length,
  }
  if (!dryRun) {
    captureServerEvent('daily-digest', 'crm_p0_leads_imported', {
      ...summary,
      kinds: [...new Set(leads.map((l) => l.trigger.kind))],
      orgIds: written.map((r) => r.org.id),
    })
  }

  return NextResponse.json({ dryRun, summary, results, errors })
}
