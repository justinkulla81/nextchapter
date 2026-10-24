import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { HIGHER_EDUCATION } from '@/lib/marketing/portal-pages/higher-education'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(HIGHER_EDUCATION.seo)

export default function HigherEducationPage() {
  return <PortalMarketingPage content={HIGHER_EDUCATION.content} />
}
