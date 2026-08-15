import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { StructuredData } from '@/components/StructuredData'
import { ComparisonPageTemplate } from '@/components/marketing/ComparisonPageTemplate'
import { COMPETITOR_COMPARISONS, getComparison } from '@/lib/marketing/competitor-comparisons'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'

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
  if (!comparison) return {}

  const url = `https://launchyournextchapter.com/vs/${comparison.slug}`
  return {
    title: comparison.metaTitle,
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
  if (!comparison) notFound()

  const [core, plus, premium] = await Promise.all([
    getCurrentPlan('outplacement_core'),
    getCurrentPlan('outplacement_plus'),
    getCurrentPlan('outplacement_premium'),
  ])

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
      <ComparisonPageTemplate
        comparison={comparison}
        ourPricing={{
          core: core?.priceCents ?? null,
          plus: plus?.priceCents ?? null,
          premium: premium?.priceCents ?? null,
        }}
      />
    </>
  )
}
