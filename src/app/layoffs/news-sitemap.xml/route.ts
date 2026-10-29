import { SITE_URL } from '@/lib/seo/facts'
import { getCompanies } from '@/lib/warn/layoff-pages'
import { meetsCompanyLayoffBar } from '@/lib/seo/page-bars'
import { stateName } from '@/lib/seo/states'

// Google News sitemap: indexable layoff company pages whose newest notice was filed in the last 2 days (Google reads only that
// window). Submit it in Search Console and list the site in Google News Publisher Center. Not in the sitemap index on purpose:
// a news sitemap is submitted on its own.
export const dynamic = 'force-dynamic'

const WINDOW_MS = 2 * 86_400_000
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET() {
  const companies = await getCompanies().catch(() => new Map())
  const cutoff = Date.now() - WINDOW_MS
  const items = [...companies.values()]
    .filter((c) => c.latest.getTime() >= cutoff && c.latest.getTime() <= Date.now() && meetsCompanyLayoffBar(c))
    .sort((a, b) => b.latest.getTime() - a.latest.getTime())
    .slice(0, 1000)
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    items.map((c) => {
      const where = c.states.length === 1 ? ` in ${stateName(c.states[0])}` : ''
      return `  <url><loc>${esc(`${SITE_URL}/layoffs/company/${c.slug}`)}</loc><news:news><news:publication><news:name>NextChapter</news:name><news:language>en</news:language></news:publication><news:publication_date>${c.latest.toISOString()}</news:publication_date><news:title>${esc(`${c.name} layoff notice${where}`)}</news:title></news:news></url>`
    }).join('\n') +
    '\n</urlset>\n'
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } })
}
