import { feedResponse } from '@/lib/syndication/job-feed-server'

// https://launchyournextchapter.com/feeds/jobs-direct.xml.gz — the feed to submit to job
// aggregators: only jobs listed on the employer's own career system, each <url> the
// employer's apply link. Built daily by /api/cron/job-feed-direct.
export const dynamic = 'force-dynamic'
// Full descriptions make the feed ~0.3-0.5 GB; a slow downloader needs the time.
export const maxDuration = 800

export const GET = (req: Request) => feedResponse('direct', req)
