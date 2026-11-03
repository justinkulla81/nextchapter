import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { buildSegments } from '@/lib/segments/build'

export const maxDuration = 800

// Rebuilds this month's job lists for every segment (src/lib/segments): one pass over the live board, then one stored edition per
// segment. Weekly, inside the Sunday bundle, so "newest this week" and the counts stay fresh; rerun-safe (a rerun overwrites the month).
export const GET = withCronRun('job-segments', async () => NextResponse.json(await buildSegments()))
