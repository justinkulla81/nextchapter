import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { buildRankings } from '@/lib/rankings/build'

export const maxDuration = 800

// Builds this month's edition of every ranking (src/lib/rankings) from two whole-board reads and public county data, and
// stores it. Rerun-safe: a second run in the same month overwrites that month's rows with identical or fresher figures.
export const GET = withCronRun('rankings', async () => NextResponse.json(await buildRankings()))
