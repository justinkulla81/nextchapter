import { LAYOFF_DATA_CITATION, LAYOFF_DATA_LICENSE, LAYOFF_DATA_LICENSE_URL, getLayoffRows, parseStateParam } from '@/lib/data/layoff-export'

export const revalidate = 3600

// Same record as layoffs.csv, as JSON, with the license and the citation to use.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('state')
  const state = parseStateParam(raw)
  if (raw && !state) return Response.json({ error: 'Unknown state. Use a two-letter code (TX) or a name (texas).' }, { status: 400 })
  const rows = await getLayoffRows(state)
  return Response.json(
    { license: LAYOFF_DATA_LICENSE, licenseUrl: LAYOFF_DATA_LICENSE_URL, cite: LAYOFF_DATA_CITATION, state, count: rows.length, notices: rows },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400', 'Access-Control-Allow-Origin': '*' } },
  )
}
