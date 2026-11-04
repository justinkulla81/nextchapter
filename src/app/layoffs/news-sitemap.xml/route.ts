import { SITE_URL } from '@/lib/seo/facts'
import { getCompanies } from '@/lib/warn/layoff-pages'
import { getAnnouncements } from '@/lib/warn/company-announcements'
import { layoffNewsItems } from '@/lib/seo/layoff-news-items'
import { meetsCompanyLayoffBar } from '@/lib/seo/page-bars'
import { stateName } from '@/lib/seo/states'

// Google News sitemap: indexable layoff company pages whose newest WARN filing or announcement is from the last 2 days (Google reads
// only that window; src/lib/seo/layoff-news-items.ts). Submit it in Search Console and list the site in Google News Publisher Center. Not in the sitemap index on purpose:
// a news sitemap is submitted on its own.
export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET() {
  const [companies, announcements] = await Promise.all([getCompanies().catch(() => new Map()), getAnnouncements().catch(() => new Map())])
  const items = layoffNewsItems(
    [...companies.values()],
    [...announcements.values()].map((a) => ({ slug: a.slug, name: a.name, latest: a.latest, buyout: a.items[0]?.kind === 'buyout' })),
    { now: Date.now(), meetsBar: (c) => meetsCompanyLayoffBar(c), stateName },
  )
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    items.map((i) => `  <url><loc>${esc(`${SITE_URL}/layoffs/company/${i.slug}`)}</loc><news:news><news:publication><news:name>NextChapter</news:name><news:language>en</news:language></news:publication><news:publication_date>${i.date.toISOString()}</news:publication_date><news:title>${esc(i.title)}</news:title></news:news></url>`).join('\n') +
    '\n</urlset>\n'
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } })
}
