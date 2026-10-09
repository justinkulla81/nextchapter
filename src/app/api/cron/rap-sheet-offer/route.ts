import { NextRequest, NextResponse } from 'next/server'
import { offerTomorrowsPitches } from '@/lib/crm/rap-sheet/offer'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await offerTomorrowsPitches()
  // Vercel only logs the request line; the result is what tells a quiet night from a failure.
  console.log('rap-sheet-offer', JSON.stringify(result))
  return NextResponse.json(result)
}
