import { layoffFeed } from '@/lib/feeds/layoff-feed'
import { rssResponse } from '@/lib/feeds/rss'
import { stateFromSlug } from '@/lib/seo/states'

export const revalidate = 900

export async function GET(_req: Request, { params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const code = stateFromSlug(state.replace(/\.xml$/, ''))
  if (!code) return new Response('Unknown state', { status: 404 })
  const slug = state.replace(/\.xml$/, '')
  return rssResponse(await layoffFeed(code, `/feeds/layoffs/${slug}`, `/layoffs/${slug}`))
}
