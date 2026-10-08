import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { reportsNewestFirst, reportPath } from '@/lib/reports'
import { AUTHORS, authorPath } from '@/lib/seo/authors'
import { canonical } from '@/lib/seo/canonical'
import { INSIGHT_ARTICLES } from '@/lib/seo/insights'
import { breadcrumbJsonLd, personJsonLd } from '@/lib/seo/jsonld'
import { formatContentDate } from '@/components/seo/AuthorByline'

export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(AUTHORS).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const author = AUTHORS[slug]
  if (!author) return {}
  const description = `${author.name}, ${author.jobTitle}. The reports, guides and articles he has written for NextChapter.`
  return {
    title: author.name,
    description,
    ...canonical(authorPath(author)),
    openGraph: { type: 'profile', title: author.name, description, ...(author.image ? { images: [author.image] } : {}) },
  }
}

const SECTION = 'text-xl font-semibold tracking-tight text-navy'
const ITEM_LINK = 'font-medium text-foreground underline-offset-4 hover:text-brand hover:underline'

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const author = AUTHORS[slug]
  if (!author) notFound()

  const reports = reportsNewestFirst()
  const guides = [...GUIDE_LANDING_CONTENT].sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={{ '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: personJsonLd(author) }} />
      <StructuredData data={breadcrumbJsonLd([{ name: author.name, path: authorPath(author) }])} />
      <PublicSiteHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {author.image && (
            <Image
              src={author.image}
              alt={author.name}
              width={320}
              height={320}
              sizes="160px"
              priority
              className="size-40 shrink-0 rounded-2xl object-cover"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{author.name}</h1>
            <p className="mt-1 text-muted-foreground">{author.jobTitle}</p>
            <TrackedLink
              href={author.linkedIn}
              event="founder_linkedin_clicked"
              properties={{ page: 'author', author: author.slug }}
              className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
            >
              {author.name.split(' ')[0]} on LinkedIn
            </TrackedLink>
          </div>
        </div>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground/85">
          {author.bio.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <section className="mt-14" aria-labelledby="research">
          <h2 id="research" className={SECTION}>Research</h2>
          <ul className="mt-4 space-y-3">
            {reports.map((r) => (
              <li key={r.slug}>
                <Link href={reportPath(r)} className={ITEM_LINK}>
                  NextChapter Displacement Report — {r.month}
                </Link>
                <span className="text-sm text-muted-foreground"> · {formatContentDate(r.publishedAt)}</span>
              </li>
            ))}
            <li>
              <Link href="/reports/white-collar-index" className={ITEM_LINK}>NextChapter White-Collar Long-Term Unemployment Index</Link>
              <span className="text-sm text-muted-foreground"> · updated monthly</span>
            </li>
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="guides">
          <h2 id="guides" className={SECTION}>Guides</h2>
          <ul className="mt-4 space-y-3">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/resources/${g.slug}`} className={ITEM_LINK}>{g.title}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="insights">
          <h2 id="insights" className={SECTION}>Insights for employers</h2>
          <ul className="mt-4 space-y-3">
            {INSIGHT_ARTICLES.map((a) => (
              <li key={a.slug}>
                <Link href={`/insights/${a.slug}`} className={ITEM_LINK}>{a.title}</Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-14 border-t border-border pt-6 text-sm text-muted-foreground">
          How we research, source and correct what we publish:{' '}
          <Link href="/editorial-standards" className="text-brand underline underline-offset-4">editorial standards</Link>.
        </p>
      </main>

      <PublicSiteFooter page="authors" />
    </div>
  )
}
