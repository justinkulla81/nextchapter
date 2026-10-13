import { NextResponse } from 'next/server'
import { offerTomorrowsPitches } from '@/lib/crm/meeting-prep/offer'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

export const GET = withCronRun('meeting-prep-offer', async () => {
  const result = await offerTomorrowsPitches()
  // Vercel only logs the request line; the result is what tells a quiet night from a failure.
  console.log('meeting-prep-offer', JSON.stringify(result))
  return NextResponse.json(result)
})
