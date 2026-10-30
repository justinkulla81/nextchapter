import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { generateDailyDrafts } from '@/lib/content/generate'

export const maxDuration = 120

// Daily, before the 7 AM digest: builds the day's post drafts from NextChapter's own data (src/lib/content/) and saves them to
// https://launchyournextchapter.com/support/admin/content-drafts. Template text only, no model call, nothing is posted;
// safe to run again, since a draft is unique per day, kind and subject.
export const GET = withCronRun('content-drafts', async () => NextResponse.json(await generateDailyDrafts()))
