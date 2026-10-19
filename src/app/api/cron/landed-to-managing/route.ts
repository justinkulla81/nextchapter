import { NextResponse } from 'next/server'
import { advanceLandedMembers } from '@/lib/journey/auto-advance'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 120

// Daily: members who landed 90 or more days ago move to Managing your career.
export const GET = withCronRun('landed-to-managing', async () => NextResponse.json(await advanceLandedMembers()))
