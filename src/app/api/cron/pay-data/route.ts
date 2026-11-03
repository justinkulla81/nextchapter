import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { refreshPayData } from '@/lib/pay-data/compute'

export const maxDuration = 300

// Daily pay data (src/lib/pay-data/compute.ts): pay by industry, function, level, employer size and hiring volume, and the skills that
// pay more, stored as the 'pay-data' board figure that /resources/pay-data reads. Also keeps one openings snapshot a month for hiring growth.
// Rerun-safe: each run overwrites the same row; the snapshot is written once per month.
export const GET = withCronRun('pay-data', async () => {
  const result = await refreshPayData()
  return NextResponse.json(result)
})
