import { stateLayoffFeed } from '@/lib/feeds/layoff-feed'
import { feedResponse } from '@/lib/feeds/rss'
import { stateFromSlug } from '@/lib/seo/states'

export async function GET(req: Request, { params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const slug = state.replace(/\.xml$/, '')
  const code = stateFromSlug(slug)
  if (!code) return new Response('Unknown state', { status: 404 })
  return feedResponse(req, await stateLayoffFeed(code, slug))
}
