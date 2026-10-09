import { NextRequest, NextResponse } from 'next/server'
import { sendTodaysApprovedRapSheets } from '@/lib/crm/rap-sheet/deliver'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await sendTodaysApprovedRapSheets()
  // Vercel only logs the request line; the result is what tells a quiet night from a failure.
  console.log('rap-sheet-send', JSON.stringify(result))
  return NextResponse.json(result)
}
