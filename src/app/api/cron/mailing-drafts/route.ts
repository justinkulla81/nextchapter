import { NextRequest, NextResponse } from 'next/server'
import { draftDueEditions } from '@/lib/mailing/drafts'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 300

/**
 * Once a day, early morning New York time: makes the draft for every list
 * whose cadence is due (daily, weekdays, monthly, quarterly, annually) and
 * emails Justin to approve each one. It never sends — that needs a person
 * to approve the text and the readership on the edition page.
 */
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await draftDueEditions()
  return NextResponse.json({ drafted: result.drafted.length, notified: result.notified })
}
