import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runTitleTests } from '@/lib/seo/title-test-run'

export const maxDuration = 300

// Daily: reads Search Console click rate for each page-title test arm and records a winner once the gap is real
// (src/lib/seo/title-test-run.ts). Safe to run again.
export const GET = withCronRun('seo-title-tests', async () => NextResponse.json(await runTitleTests()))
