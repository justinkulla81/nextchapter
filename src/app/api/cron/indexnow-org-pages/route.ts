import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runOrgPagesIndexNow } from '@/lib/syndication/indexnow-org-pages'

export const maxDuration = 800

// Daily: tells IndexNow about American Job Center, economic development and workforce board pages that are new or
// changed since the last run (src/lib/syndication/indexnow-org-pages.ts). Safe to run again: it only sends changes.
export const GET = withCronRun('indexnow-org-pages', async () => NextResponse.json(await runOrgPagesIndexNow()))
