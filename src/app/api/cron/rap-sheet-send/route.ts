import { NextRequest, NextResponse } from 'next/server'
import { sendTodaysApprovedRapSheets } from '@/lib/crm/rap-sheet/deliver'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await sendTodaysApprovedRapSheets())
}
