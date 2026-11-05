import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runEmployerBrandScan } from '@/lib/branding/employer-scan'

// Daily, in the 12:00 UTC bundle: reads the brand colors of the newest layoff employers that have none, so a new layoff page gets the
// company's own colors within a day (until then it uses the fallback pair), then of the companies hiring the most. 40 a run, each from its own website.
export const maxDuration = 300

export const GET = withCronRun('employer-brand-scan', async () => NextResponse.json(await runEmployerBrandScan()))
