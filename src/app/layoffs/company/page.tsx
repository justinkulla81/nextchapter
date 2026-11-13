import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { pageMetadata } from '@/lib/seo/keywords'
import { getCompanies } from '@/lib/warn/layoff-pages'
import { getAnnouncements } from '@/lib/warn/company-announcements'
import { directoryLetter, layoffDirectory } from '@/lib/warn/layoff-directory'

// Every company with a layoff page, A–Z: one link to each, so every layoff page (and each new one as soon as it is recorded) is two
// clicks from the layoff tracker instead of reachable only through the sitemap. Same data and cache as /layoffs/sitemap.xml.

export const revalidate = 21600 // 6 hours, as /layoffs/by-state

export const metadata: Metadata = pageMetadata('/layoffs/company')

const monthYear = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export default async function LayoffCompaniesPage() {
  const [companies, announcements] = await Promise.all([getCompanies().catch(() => new Map()), getAnnouncements().catch(() => new Map())])
  const entries = layoffDirectory(companies, announcements)
  const groups = new Map<string, typeof entries>()
  for (const e of entries) groups.set(directoryLetter(e.name), [...(groups.get(directoryLetter(e.name)) ?? []), e])
  const letters = [...groups.keys()].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))

  return (
    <SeoPage
      squiggle
      trail={[{ name: 'Layoff tracker', path: '/layoffs' }, { name: 'Companies with layoffs', path: '/layoffs/company' }]}
      h1="Companies with layoffs: every employer, A to Z"
      lede={
        <>
          <p>
            {entries.length.toLocaleString('en-US')} employers filed a layoff notice with a state or announced job cuts in the last 12 months. Open a company for how many
            jobs were cut, where, when, the source, and what to do if you were affected.
          </p>
          <AuthorByline updated={new Date().toISOString().slice(0, 10)} className="mt-4" />
        </>
      }
    >
      {entries.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          The company list could not be loaded just now. The <Link href="/layoffs" className={LINK}>layoff tracker</Link> has the latest notices.
        </p>
      ) : (
        <>
          <nav aria-label="Jump to a letter" className="mt-8 flex flex-wrap gap-2">
            {letters.map((l) => (
              <a key={l} href={`#letter-${l === '#' ? 'other' : l}`} className="rounded-md border border-border px-2.5 py-1 text-sm font-medium text-navy hover:bg-muted">
                {l}
              </a>
            ))}
          </nav>
          {letters.map((l) => (
            <section key={l} aria-labelledby={`letter-${l === '#' ? 'other' : l}`} className="mt-8">
              <h2 id={`letter-${l === '#' ? 'other' : l}`} className={H2}>{l === '#' ? '0–9 and other' : l}</h2>
              <ul className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {groups.get(l)!.map((e) => (
                  <li key={e.slug}>
                    <Link href={`/layoffs/company/${e.slug}`} className={LINK}>{e.name} layoffs</Link>
                    <span className="text-muted-foreground">
                      {' '}· {monthYear(e.latest)}
                      {e.workers ? ` · ${e.workers.toLocaleString('en-US')} jobs` : ''}
                      {e.states.length ? ` · ${e.states.slice(0, 3).join(', ')}${e.states.length > 3 ? ' +' : ''}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </SeoPage>
  )
}
