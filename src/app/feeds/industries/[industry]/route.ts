import { industryLayoffFeed } from '@/lib/feeds/layoff-feed'
import { feedResponse } from '@/lib/feeds/rss'
import { industryBySlug } from '@/lib/seo/topics'

export async function GET(req: Request, { params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params
  const ind = industryBySlug(industry.replace(/\.xml$/, ''))
  if (!ind) return new Response('Unknown industry', { status: 404 })
  return feedResponse(req, await industryLayoffFeed(ind.name))
}
