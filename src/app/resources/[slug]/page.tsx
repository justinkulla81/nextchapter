import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { StructuredData } from '@/components/StructuredData'
import { GuideLandingPageTemplate } from '@/components/guides/GuideLandingPageTemplate'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'

export function generateStaticParams() {
  return GUIDE_LANDING_CONTENT.map((content) => ({ slug: content.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const content = GUIDE_LANDING_CONTENT.find((c) => c.slug === slug)
  if (!content) return {}

  const url = `https://launchyournextchapter.com/resources/${slug}`
  return {
    title: content.title,
    description: content.metaDescription,
    alternates: { canonical: `/resources/${slug}` },
    openGraph: {
      title: content.title,
      description: content.metaDescription,
      url,
      type: 'article',
    },
  }
}

export default async function GuideResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const content = GUIDE_LANDING_CONTENT.find((c) => c.slug === slug)
  if (!content) notFound()

  const url = `https://launchyournextchapter.com/resources/${slug}`
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: content.title,
    description: content.metaDescription,
    dateModified: content.lastUpdated,
    author: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
    publisher: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
    mainEntityOfPage: url,
  }

  return (
    <>
      <StructuredData data={articleJsonLd} />
      <GuideLandingPageTemplate content={content} />
    </>
  )
}
