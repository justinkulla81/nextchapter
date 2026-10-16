import { NextResponse, type NextRequest } from 'next/server'
import { runWinBack } from '@/lib/email/dispatch/run-win-back'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await runWinBack())
}
