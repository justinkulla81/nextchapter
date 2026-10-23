import { feedResponse } from '@/lib/syndication/job-feed-server'

// https://launchyournextchapter.com/feeds/jobs-jooble.xml.gz — the direct-listing jobs in
// Jooble's own XML format (published within 45 days), each link the employer's apply page.
// Built daily by /api/cron/job-feed-jooble.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const GET = () => feedResponse('jooble')
