import { getLayoffRows, parseStateParam, toCsv } from '@/lib/data/layoff-export'

export const revalidate = 3600

// The layoff record as a spreadsheet: every WARN filing of the last 24 months, or one state with ?state=TX.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('state')
  const state = parseStateParam(raw)
  if (raw && !state) return new Response('Unknown state. Use a two-letter code (TX) or a name (texas).', { status: 400 })
  const csv = toCsv(await getLayoffRows(state))
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `inline; filename="nextchapter-layoffs${state ? `-${state.toLowerCase()}` : ''}.csv"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
