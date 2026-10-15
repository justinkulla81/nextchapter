import { NextResponse } from 'next/server'
import { draftDueEditions } from '@/lib/mailing/drafts'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

/**
 * Once a day, early morning New York time: makes the draft for every list
 * whose cadence is due (daily, weekdays, monthly, quarterly, annually) and
 * emails Justin to approve each one. It never sends — that needs a person
 * to approve the text and the readership on the edition page.
 */
export const GET = withCronRun('mailing-drafts', async () => {
  const result = await draftDueEditions()
  return NextResponse.json({ drafted: result.drafted.length, notified: result.notified })
})
