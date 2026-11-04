import { ogPoster, POSTER_SIZE } from '@/lib/seo/og-poster'
import { getAnnouncements } from '@/lib/warn/company-announcements'
import { getPublicNotices, noticeDay } from '@/lib/warn/layoff-pages'

export const alt = 'Employer layoff notices'
export const size = POSTER_SIZE
export const contentType = 'image/png'
export const revalidate = 86400 // 24 hours: every regeneration is a billed ISR write

const n = (v: number) => v.toLocaleString('en-US')

/**
 * The share card for an employer's layoff page: its biggest real number, large, in a palette and layout picked from the employer so
 * every employer looks different. WARN filings give the workers named; an employer with only announcements (a news-reported layoff or
 * buyout) gets the announced number, or the word when no number was given. Never the generic "Employer layoffs".
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [rows, announcements] = await Promise.all([
    getPublicNotices().then((all) => all.filter((x) => x.slug === slug)).catch(() => []),
    getAnnouncements().catch(() => new Map()),
  ])
  const ann = announcements.get(slug)
  const lead = ann?.items[0]
  const name = rows.map((r) => r.employer).sort((a, b) => a.length - b.length)[0] ?? ann?.name ?? 'Layoff tracker'
  const workers = rows.reduce((s, r) => s + (r.workers ?? 0), 0)

  if (rows.length && workers) {
    return ogPoster({
      seed: slug, kicker: 'Layoff tracker', big: n(workers), unit: workers === 1 ? 'worker named' : 'workers named', title: name,
      detail: `${rows.length === 1 ? 'WARN notice' : `${n(rows.length)} WARN notices`}, latest filed ${noticeDay(rows[0].noticeDate)}`, people: workers,
    })
  }
  if (lead?.workers) {
    return ogPoster({
      seed: slug, kicker: lead.kind === 'buyout' ? 'Buyout offered' : 'Layoff tracker', big: n(lead.workers),
      unit: lead.kind === 'buyout' ? 'employees offered' : 'jobs cut', title: name, detail: `Announced ${noticeDay(lead.date)}`,
      people: lead.kind === 'buyout' ? undefined : lead.workers,
    })
  }
  if (rows.length) {
    return ogPoster({ seed: slug, kicker: 'Layoff tracker', big: n(rows.length), unit: rows.length === 1 ? 'WARN notice' : 'WARN notices', title: name, detail: `Latest filed ${noticeDay(rows[0].noticeDate)}` })
  }
  return ogPoster({ seed: slug, kicker: 'Layoff tracker', big: lead?.kind === 'buyout' ? 'Buyouts' : 'Layoffs', unit: 'announced', title: name, detail: lead ? `Reported ${noticeDay(lead.date)}` : undefined })
}
