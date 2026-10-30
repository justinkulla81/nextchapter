import { SITE_URL } from '@/lib/seo/facts'
import { stateSlug } from '@/lib/seo/states'
import { TWELVE_MONTHS_MS, getCompanies, getStateSummaries } from '@/lib/warn/layoff-pages'
import { MONTH_MIN_NOTICES, getMonths } from '@/lib/layoffs/monthly'
import { getAnnouncements, hasRecentAnnouncement } from '@/lib/warn/company-announcements'

// Every recent layoff page in one sitemap: the tracker hub, each state with a notice in the last 12 months, and every employer
// with a filing in the last 12 months (src/lib/seo/page-bars.ts indexes all of them). Search Console reports "indexed" per
// sitemap, so submitting this one on its own shows how many recent layoff pages Google has taken. Listed in the sitemap index
// (src/app/sitemap-index.xml/route.ts); the main sitemap lists the same URLs.
export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export async function GET() {
  const [states, companies, announcements] = await Promise.all([getStateSummaries().catch(() => []), getCompanies().catch(() => new Map()), getAnnouncements().catch(() => new Map())])
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const urls: { loc: string; lastmod: string }[] = []
  const newest = [...states].reduce((m, s) => (s.latest > m ? s.latest : m), new Date(0))
  if (states.length) urls.push({ loc: `${SITE_URL}/layoffs`, lastmod: newest.toISOString() })
  // The year page and each month with enough notices to be indexed.
  if (states.length) urls.push({ loc: `${SITE_URL}/layoffs/2026`, lastmod: newest.toISOString() })
  for (const m of (await getMonths().catch(() => [])).filter((x) => x.count >= MONTH_MIN_NOTICES)) urls.push({ loc: `${SITE_URL}/layoffs/2026/${m.slug}`, lastmod: newest.toISOString() })
  for (const s of states) urls.push({ loc: `${SITE_URL}/layoffs/${stateSlug(s.state)}`, lastmod: s.latest.toISOString() })
  for (const c of companies.values()) {
    if (c.latest.getTime() >= cutoff) urls.push({ loc: `${SITE_URL}/layoffs/company/${c.slug}`, lastmod: c.latest.toISOString() })
  }
  // Employers with a recent announcement or press-reported cut and no WARN filing yet (their page is indexed too).
  const listed = new Set(urls.map((u) => u.loc))
  for (const a of announcements.values()) {
    const loc = `${SITE_URL}/layoffs/company/${a.slug}`
    if (!hasRecentAnnouncement(a) || listed.has(loc)) continue
    const c = companies.get(a.slug)
    urls.push({ loc, lastmod: (c && c.latest > a.latest ? c.latest : a.latest).toISOString() })
  }
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') +
    '\n</urlset>\n'
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
