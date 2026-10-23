import { feedResponse } from '@/lib/syndication/job-feed-server'

// https://launchyournextchapter.com/feeds/jobs.xml.gz — the aggregator feed (Indeed-style
// XML, gzipped) of every job with a public page. Built daily into Supabase Storage as
// parts (src/lib/syndication/job-feed-server.ts); streamed as one .gz file.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const GET = () => feedResponse('all')
