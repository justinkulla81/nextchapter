import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runBingSubmit } from '@/lib/syndication/bing-submit'

export const maxDuration = 120

// Daily: Bing Webmaster URL submission for the latest layoff pages, then layoff pages never submitted (src/lib/syndication/bing-submit.ts).
// A dry run until BING_WEBMASTER_API_KEY is set.
export const GET = withCronRun('bing-url-submit', async () => NextResponse.json(await runBingSubmit()))
