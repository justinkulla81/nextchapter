import { feedResponse } from '@/lib/syndication/job-feed-server'

// https://launchyournextchapter.com/feeds/jobs-jooble.xml.gz — the direct-listing jobs in
// Jooble's own XML format (published within 45 days), each link the employer's apply page.
// Built daily by /api/cron/job-feed-jooble.
export const dynamic = 'force-dynamic'
// Full descriptions make the feed ~0.3-0.5 GB; a slow downloader needs the time.
export const maxDuration = 800

export const GET = (req: Request) => feedResponse('jooble', req)
