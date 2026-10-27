import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { StructuredData } from '@/components/StructuredData'
import { GuideLandingPageTemplate } from '@/components/guides/GuideLandingPageTemplate'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld'

export function generateStaticParams() {
  // cobra-aca has its own page (src/app/resources/cobra-aca/page.tsx); the gated guide is an extra on it.
  return GUIDE_LANDING_CONTENT.filter((content) => content.slug !== 'cobra-aca').map((content) => ({ slug: content.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const content = GUIDE_LANDING_CONTENT.find((c) => c.slug === slug)
  if (!content) return {}

  const base = pageMetadata(`/resources/${slug}`)
  return { ...base, openGraph: { ...base.openGraph, type: 'article' } }
}

export default async function GuideResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const content = GUIDE_LANDING_CONTENT.find((c) => c.slug === slug)
  if (!content) notFound()

  const path = `/resources/${slug}`

  return (
    <>
      <StructuredData
        data={articleJsonLd({
          headline: pageH1(`/resources/${slug}`, content.title),
          path,
          description: content.metaDescription,
          dateModified: content.lastUpdated,
        })}
      />
      <StructuredData data={breadcrumbJsonLd([{ name: 'Resources', path: '/resources' }, { name: content.title, path }])} />
      <GuideLandingPageTemplate content={content} />
    </>
  )
}
