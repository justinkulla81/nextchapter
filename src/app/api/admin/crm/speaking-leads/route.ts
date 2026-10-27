import { NextResponse, type NextRequest } from 'next/server'
import { importSpeakingLeads, parseSpeakingLeads, syncSpeakingTasks } from '@/lib/speaking/sync'
import { captureServerEvent } from '@/lib/posthog/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 60
const MAX_LEADS = 100

// Write path for the weekly speaking-discovery task (same Bearer key as the p0-leads endpoint). Re-posting a lead is
// harmless: each is keyed on its link, and a repeat comes back alreadyLogged.
export function GET() {
  return NextResponse.json({ version: 1, kinds: ['KEYNOTE', 'PANEL', 'RESEARCH_APPLICATION', 'DEMO_DAY', 'PODCAST_WEBINAR', 'AWARD_CHALLENGE'] })
}

export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON: { leads: [...], dryRun?: boolean }' }, { status: 400 })
  }
  const { leads, errors } = parseSpeakingLeads(body)
  if (leads.length > MAX_LEADS) return NextResponse.json({ error: `Send at most ${MAX_LEADS} leads per request` }, { status: 400 })
  const dryRun = (body as { dryRun?: unknown }).dryRun === true
  const results = await importSpeakingLeads(leads, dryRun)
  const created = results.filter((r) => !r.alreadyLogged).length
  const tasks = dryRun ? { opened: 0, closed: 0 } : await syncSpeakingTasks()
  if (!dryRun) captureServerEvent('speaking-discovery', 'ceo_speaking_leads_imported', { received: leads.length + errors.length, created, rejected: errors.length, tasksOpened: tasks.opened })
  return NextResponse.json({ dryRun, summary: { received: leads.length + errors.length, rejected: errors.length, created, alreadyLogged: results.length - created, tasksOpened: tasks.opened }, results, errors })
}
