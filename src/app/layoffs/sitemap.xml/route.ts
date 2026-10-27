import { SITE_URL } from '@/lib/seo/facts'
import { stateSlug } from '@/lib/seo/states'
import { TWELVE_MONTHS_MS, getCompanies, getStateSummaries } from '@/lib/warn/layoff-pages'

// Every recent layoff page in one sitemap: the tracker hub, each state with a notice in the last 12 months, and every employer
// with a filing in the last 12 months (src/lib/seo/page-bars.ts indexes all of them). Search Console reports "indexed" per
// sitemap, so submitting this one on its own shows how many recent layoff pages Google has taken. Listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts); the main sitemap lists the same URLs.
export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export async function GET() {
  const [states, companies] = await Promise.all([getStateSummaries().catch(() => []), getCompanies().catch(() => new Map())])
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const urls: { loc: string; lastmod: string }[] = []
  const newest = [...states].reduce((m, s) => (s.latest > m ? s.latest : m), new Date(0))
  if (states.length) urls.push({ loc: `${SITE_URL}/layoffs`, lastmod: newest.toISOString() })
  for (const s of states) urls.push({ loc: `${SITE_URL}/layoffs/${stateSlug(s.state)}`, lastmod: s.latest.toISOString() })
  for (const c of companies.values()) {
    if (c.latest.getTime() >= cutoff) urls.push({ loc: `${SITE_URL}/layoffs/company/${c.slug}`, lastmod: c.latest.toISOString() })
  }
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') +
    '\n</urlset>\n'
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
