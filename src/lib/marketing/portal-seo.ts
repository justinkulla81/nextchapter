import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo/facts'

// SEO for the portal pages built on PortalMarketingPage: metadata (title, description, canonical, Open Graph,
// Twitter) and one JSON-LD graph (Service, FAQPage, BreadcrumbList). The graph carries plan names only: no price,
// no Offer and no amount, by owner decision 2026-10-23. src/test/portal-pages.test.ts checks every page.

export interface PortalSeo {
  /** The page title, before the site's " | NextChapter" suffix. Unique per page. */
  title: string
  description: string
  /** The page's own path, e.g. /higher-education. */
  path: string
  /** Hero image shown when the page is shared: a published path, e.g. /marketing/higher-ed-admin-overview.webp. */
  image?: { src: string; width: number; height: number; alt: string }
}

export function portalMetadata(seo: PortalSeo): Metadata {
  const url = `${SITE_URL}${seo.path}`
  const images = seo.image ? [{ url: `${SITE_URL}${seo.image.src}`, width: seo.image.width, height: seo.image.height, alt: seo.image.alt }] : undefined
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.path },
    openGraph: { type: 'website', siteName: 'NextChapter', locale: 'en_US', title: seo.title, description: seo.description, url, images },
    twitter: { card: 'summary_large_image', title: seo.title, description: seo.description, images: images?.map((i) => i.url) },
  }
}

export interface PortalJsonLdInput {
  path: string
  /** The service, as one noun phrase: "Career services and alumni workspace for colleges". */
  serviceName: string
  serviceType: string
  audienceType: string
  description: string
  /** Names only. Never an amount. */
  planNames: string[]
  faq: { q: string; a: string }[]
  /** Breadcrumb trail after "Home", ending at this page. */
  trail: { name: string; path: string }[]
}

export function portalJsonLd(i: PortalJsonLdInput): Record<string, unknown> {
  const url = `${SITE_URL}${i.path}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: i.serviceName,
        serviceType: i.serviceType,
        description: i.description,
        url,
        provider: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL },
        areaServed: 'US',
        audience: { '@type': 'BusinessAudience', audienceType: i.audienceType },
        // Plan names only, as a property: the graph never holds an Offer or a price.
        additionalProperty: i.planNames.length
          ? [{ '@type': 'PropertyValue', name: 'Plans', value: i.planNames.join(', ') }]
          : undefined,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: i.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [{ name: 'Home', path: '/' }, ...i.trail].map((c, n) => ({
          '@type': 'ListItem',
          position: n + 1,
          name: c.name,
          item: c.path === '/' ? SITE_URL : `${SITE_URL}${c.path}`,
        })),
      },
    ],
  }
}
