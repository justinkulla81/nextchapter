import { allLayoffFeed } from '@/lib/feeds/layoff-feed'
import { feedResponse } from '@/lib/feeds/rss'

// New WARN layoff notices, all states. One state: /feeds/layoffs/<state>. Add ?format=json for JSON Feed.
export async function GET(req: Request) {
  return feedResponse(req, await allLayoffFeed())
}
