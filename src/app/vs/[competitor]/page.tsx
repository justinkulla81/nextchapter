import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { StructuredData } from '@/components/StructuredData'
import { ComparisonPageTemplate } from '@/components/marketing/ComparisonPageTemplate'
import { COMPETITOR_COMPARISONS, getComparison } from '@/lib/marketing/competitor-comparisons'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { AlternativePageTemplate } from '@/components/marketing/AlternativePageTemplate'
import { getAlternative } from '@/lib/marketing/alternatives'

// The four hand-written outplacement comparisons are built at deploy. Every other competitor page is generated from the
// competitor matrix on first request (no database read at build) and kept by the CDN; see next.config.ts.
export const dynamicParams = true

export function generateStaticParams() {
  return COMPETITOR_COMPARISONS.map((c) => ({ competitor: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>
}): Promise<Metadata> {
  const { competitor } = await params
  const comparison = getComparison(competitor)
  if (!comparison) {
    const alt = await getAlternative(competitor)
    if (!alt) return {}
    return {
      title: { absolute: alt.title },
      description: alt.description,
      alternates: { canonical: `/vs/${alt.slug}` },
      robots: alt.indexable ? undefined : { index: false, follow: true },
      openGraph: { title: alt.title, description: alt.description, url: `https://launchyournextchapter.com/vs/${alt.slug}`, type: 'article' },
    }
  }

  const url = `https://launchyournextchapter.com/vs/${comparison.slug}`
  return {
    // Absolute: metaTitle already leads with the brand.
    title: { absolute: comparison.metaTitle },
    description: comparison.metaDescription,
    alternates: { canonical: `/vs/${comparison.slug}` },
    openGraph: {
      title: comparison.metaTitle,
      description: comparison.metaDescription,
      url,
      type: 'article',
    },
  }
}

// Partners Master Build Script §D2.8 route table: /vs/lhh ·
// /vs/randstad-risesmart · /vs/careerminds · /vs/intoo. One dynamic route
// keeps the four pages consistent (same template, same claims discipline)
// rather than four hand-copied files that could drift out of sync.
export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ competitor: string }>
}) {
  const { competitor } = await params
  const comparison = getComparison(competitor)
  if (!comparison) {
    const alt = await getAlternative(competitor)
    if (!alt) notFound()
    return (
      <>
        <StructuredData data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: alt.title, description: alt.description, url: `https://launchyournextchapter.com/vs/${alt.slug}` }} />
        <StructuredData data={breadcrumbJsonLd([{ name: 'Compare', path: '/vs' }, { name: `vs. ${alt.name}`, path: `/vs/${alt.slug}` }])} />
        <AlternativePageTemplate page={alt} />
      </>
    )
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: comparison.metaTitle,
    description: comparison.metaDescription,
    url: `https://launchyournextchapter.com/vs/${comparison.slug}`,
  }

  return (
    <>
      <StructuredData data={jsonLd} />
      <StructuredData data={breadcrumbJsonLd([{ name: 'Compare', path: '/vs' }, { name: `vs. ${comparison.name}`, path: `/vs/${comparison.slug}` }])} />
      <ComparisonPageTemplate comparison={comparison} />
    </>
  )
}
