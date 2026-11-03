import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LeadLanding } from '@/components/marketing/lead-landing/LeadLanding'
import { LEAD_OFFERS, isLeadOfferKey } from '@/lib/marketing/lead-landing'

// The paid-search lead pages for buyers (src/lib/marketing/lead-landing.ts). Not for search: noindex, and the public
// pages for the same audiences carry the search traffic.

export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(LEAD_OFFERS).map((offer) => ({ offer }))
}

export async function generateMetadata({ params }: { params: Promise<{ offer: string }> }): Promise<Metadata> {
  const { offer } = await params
  if (!isLeadOfferKey(offer)) return {}
  const o = LEAD_OFFERS[offer]
  return {
    title: { absolute: o.seo.title },
    description: o.seo.description,
    alternates: { canonical: o.path },
    robots: { index: false, follow: true },
  }
}

export default async function LeadPage({ params }: { params: Promise<{ offer: string }> }) {
  const { offer } = await params
  if (!isLeadOfferKey(offer)) notFound()
  return <LeadLanding offer={LEAD_OFFERS[offer]} />
}
