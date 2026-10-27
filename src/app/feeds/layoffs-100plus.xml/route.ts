import { largeLayoffFeed } from '@/lib/feeds/layoff-feed'
import { feedResponse } from '@/lib/feeds/rss'

// Only notices naming 100 or more workers: low volume, so it stays subscribed.
export async function GET(req: Request) {
  return feedResponse(req, await largeLayoffFeed())
}
