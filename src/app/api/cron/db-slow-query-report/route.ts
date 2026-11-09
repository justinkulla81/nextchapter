import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runDbSlowQueryReport } from '@/lib/perf/db-report'

export const maxDuration = 60

// Mondays (in bundle-monday): emails what loaded the database since last week's snapshot: the statements with the most time, rows returned (egress)
// and disk reads (Disk IO), the cache hit share and the watched tables' growth (lib/perf/db-report.ts).
export const GET = withCronRun('db-slow-query-report', async () => NextResponse.json(await runDbSlowQueryReport()))
