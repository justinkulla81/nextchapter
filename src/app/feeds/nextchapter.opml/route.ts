import { opml } from '@/lib/feeds/catalog'

export const dynamic = 'force-static'
export const revalidate = 86400

// Every feed in one file, to import into a feed reader in one step.
export function GET() {
  return new Response(opml(), { headers: { 'Content-Type': 'text/x-opml; charset=utf-8', 'Content-Disposition': 'inline; filename="nextchapter-feeds.opml"', 'Cache-Control': 'public, s-maxage=86400' } })
}
