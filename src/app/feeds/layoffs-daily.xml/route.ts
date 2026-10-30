import { feedResponse } from '@/lib/feeds/rss'
import { dailyLayoffFeed } from '@/lib/feeds/layoff-feed'

// One item a day: the day's notice and worker counts and the largest filings, for newsrooms and bloggers who quote a number.
export async function GET(req: Request) {
  return feedResponse(req, await dailyLayoffFeed())
}
