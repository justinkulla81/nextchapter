import { feedResponse } from '@/lib/syndication/job-feed-server'

// https://launchyournextchapter.com/feeds/jobs-direct.xml.gz — the feed to submit to job
// aggregators: only jobs listed on the employer's own career system, each <url> the
// employer's apply link. Built daily by /api/cron/job-feed-direct.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const GET = () => feedResponse('direct')
