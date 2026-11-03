import type { Metadata } from 'next'
import Link from 'next/link'
import { MONTH_TINTS } from '@/components/rankings/tones'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { archiveMonths } from '@/lib/rankings/awards'
import { RANKINGS_HERO } from '@/lib/rankings/art'
import { editionLabel } from '@/lib/rankings/build-edition'
import { readRankingIndex } from '@/lib/rankings/store'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 21600

export const metadata: Metadata = {
  title: titleMeta('Job market rankings archive: every month'),
  description: 'Every monthly edition of our job market rankings, kept online: see how cities, counties, job families and AI skills moved from one month to the next.',
  ...canonical('/rankings/archive'),
}

export default async function RankingsArchive() {
  const index = await readRankingIndex().catch(() => [])
  const months = archiveMonths(index)
  const count = (ed: string) => index.filter((x) => x.editions.includes(ed)).length
  return (
    <SeoPage
      look="scene"
      calm
      hero={RANKINGS_HERO}
      capture={{ kind: 'ranking', slug: 'archive', label: 'professional', save: { q: '', loc: '' } }}
      trail={[{ name: 'Rankings', path: '/rankings' }, { name: 'Archive', path: '/rankings/archive' }]}
      h1="Job market rankings archive"
      lede={<>Every month&apos;s edition of every ranking stays online at its own address. Pick a month to see all of its lists, or open a ranking and use its month-by-month links.</>}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Job market rankings archive', url: `${SITE_URL}/rankings/archive` }]}
    >
      <section aria-labelledby="months">
        <h2 id="months" className={H2}>Browse by month</h2>
        {months.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">The first monthly rankings are not published yet. <Link href="/rankings" className={LINK}>See the rankings hub</Link>.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {months.map((ed, i) => (
              <li key={ed} className={`rounded-xl p-5 ${MONTH_TINTS[i % MONTH_TINTS.length]}`}>
                <h3 className="text-lg font-semibold text-navy"><Link href={`/rankings/archive/${ed}`} className="hover:underline">{editionLabel(ed)}</Link></h3>
                <p className="mt-1 text-sm text-muted-foreground">{count(ed)} rankings</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-8 text-sm"><Link href="/rankings" className={LINK}>All current rankings</Link></p>
    </SeoPage>
  )
}
