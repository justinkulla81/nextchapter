import { layoffFeed } from '@/lib/feeds/layoff-feed'
import { rssResponse } from '@/lib/feeds/rss'

export const revalidate = 900

// New WARN layoff notices, all states. One state: /feeds/layoffs/<state>.
export async function GET() {
  return rssResponse(await layoffFeed(null, '/feeds/layoffs', '/layoffs'))
}
