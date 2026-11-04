import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runDbSlowQueryReport } from '@/lib/perf/db-report'

export const maxDuration = 60

// Mondays (in bundle-monday): emails the ten statements that took the most database time since last week's snapshot (lib/perf/db-report.ts).
export const GET = withCronRun('db-slow-query-report', async () => NextResponse.json(await runDbSlowQueryReport()))
