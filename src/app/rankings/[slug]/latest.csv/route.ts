import { readRanking, readRankingIndex } from '@/lib/rankings/store'

export const revalidate = 21600 // 6 hours: was hourly; every regeneration is a billed ISR write

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

// The newest edition of a ranking as a CSV: rank, place, state, score, sample and the supporting figures.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = (await readRankingIndex()).find((x) => x.slug === slug)
  const e = entry ? await readRanking(slug, entry.edition) : null
  if (!e) return new Response('Not found', { status: 404 })
  const statLabels = e.rows[0]?.stats.map((s) => s.label) ?? []
  const head = ['rank', ({ counties: 'county', states: 'state', skills: 'skill', tools: 'tool', certifications: 'certification', colleges: 'college', industries: 'industry', 'job families': 'job family', degrees: 'field or level', occupations: 'occupation', employers: 'employer' } as Record<string, string>)[e.placeNoun] ?? 'city', 'state', 'score', 'sample', ...statLabels, 'edition']
  const lines = [head.map(cell).join(','), ...e.rows.map((r) => [r.rank, r.name, r.sub, r.valueLabel, r.n, ...r.stats.map((s) => s.value), e.edition].map(cell).join(','))]
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}-${e.edition}.csv"`, 'Cache-Control': 'public, max-age=3600' } })
}
