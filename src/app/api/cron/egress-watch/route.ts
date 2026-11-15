import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runEgressWatch } from '@/lib/perf/egress-watch'

export const maxDuration = 60

// Hourly (in bundle-hourly-light): estimates the database data use as GB a day and emails the owner, at most once a day, when it
// passes 8 GB a day (lib/perf/egress-watch.ts). Owner decision 2026-11-14.
export const GET = withCronRun('egress-watch', async () => NextResponse.json(await runEgressWatch()))
