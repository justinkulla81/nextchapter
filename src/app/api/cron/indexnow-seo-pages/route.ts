import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runSeoPagesIndexNow } from '@/lib/syndication/indexnow-seo-pages'

export const maxDuration = 800

// Daily: tells IndexNow about employer, nonprofit, workforce-board state, rapid-response, higher-education state and layoff
// pages that are new, or (layoff pages) have a newer notice, since the last run (src/lib/syndication/indexnow-seo-pages.ts).
// Safe to run again: it only sends what has not been announced.
export const GET = withCronRun('indexnow-seo-pages', async () => NextResponse.json(await runSeoPagesIndexNow()))
