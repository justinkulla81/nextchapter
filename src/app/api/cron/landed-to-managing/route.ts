import { NextResponse, type NextRequest } from 'next/server'
import { advanceLandedMembers } from '@/lib/journey/auto-advance'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 120

// Daily: members who landed 90 or more days ago move to Managing your career.
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await advanceLandedMembers())
}
