import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runLayoffIndexNow } from '@/lib/syndication/indexnow-layoffs'

export const maxDuration = 120

// Hourly: refreshes and announces layoff pages whose record changed since the last run (src/lib/syndication/indexnow-layoffs.ts).
export const GET = withCronRun('indexnow-layoffs', async () => NextResponse.json(await runLayoffIndexNow()))
