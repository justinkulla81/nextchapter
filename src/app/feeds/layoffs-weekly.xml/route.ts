import { feedResponse } from '@/lib/feeds/rss'
import { weeklyLayoffFeed } from '@/lib/feeds/layoff-feed'

// One item a week: the totals and the largest notices.
export async function GET(req: Request) {
  return feedResponse(req, await weeklyLayoffFeed())
}
