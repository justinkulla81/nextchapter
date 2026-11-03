import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { MIN_ANSWERS_TO_SHOW } from '@/lib/layoff-stories/rules'
import { publishOpen, storyCounts } from '@/lib/layoff-stories/store'
import { getCompanies } from '@/lib/warn/layoff-pages'

export const metadata: Metadata = { title: { absolute: 'Layoff stories: what happened to people laid off | NextChapter' }, description: 'Notice, severance and how it was handled, from people who were laid off. Share yours in two minutes.', robots: { index: publishOpen(), follow: true } }
export const revalidate = 3600

export default async function StoriesHubPage() {
  const [counts, companies] = await Promise.all([storyCounts(), getCompanies()])
  const listed = [...counts.entries()].filter(([, n]) => n >= MIN_ANSWERS_TO_SHOW).sort((a, b) => b[1] - a[1]).slice(0, 30)
  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-navy">Layoff stories</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">What people got for notice and severance, and how they were told, in their own answers. Private by default.</p>
          <Link href="/layoffs/stories/new?source=hub" className="mt-6 inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white hover:opacity-90">Share what happened to you</Link>
          {listed.length > 0 ? (
            <section aria-labelledby="where" className="mt-12">
              <h2 id="where" className="text-xl font-semibold tracking-tight text-navy">Companies with the most answers</h2>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {listed.map(([slug, n]) => companies.get(slug) && (
                  <li key={slug}><Link href={`/layoffs/company/${slug}`} className="text-brand underline underline-offset-4">{companies.get(slug)!.name}</Link> <span className="text-muted-foreground">· {n} {n === 1 ? 'person' : 'people'} shared</span></li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="mt-10 max-w-xl text-sm text-muted-foreground">Numbers for a company appear here once five people have shared. Be one of them.</p>
          )}
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
