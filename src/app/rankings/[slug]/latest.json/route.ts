import { readRanking, readRankingIndex } from '@/lib/rankings/store'

export const revalidate = 21600 // 6 hours: was hourly; every regeneration is a billed ISR write

// The newest edition of a ranking as JSON: the rows with every figure, the method and the sources. Free to use with a link back.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = (await readRankingIndex()).find((x) => x.slug === slug)
  const e = entry ? await readRanking(slug, entry.edition) : null
  if (!e) return new Response('Not found', { status: 404 })
  return Response.json({ ...e, license: 'Free to use and share with a link to https://launchyournextchapter.com/rankings/' + slug }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
