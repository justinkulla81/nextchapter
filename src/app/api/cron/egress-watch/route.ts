import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runEgressWatch } from '@/lib/perf/egress-watch'

export const maxDuration = 60

// Daily (in bundle-data-light): estimates the day's database data use and emails the admin when it passes the alert line
// (lib/perf/egress-watch.ts). Owner decision 2026-11-14.
export const GET = withCronRun('egress-watch', async () => NextResponse.json(await runEgressWatch()))
