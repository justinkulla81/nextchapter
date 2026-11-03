import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { CAREER_SERVICES } from '@/lib/marketing/portal-pages/for-colleges'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(CAREER_SERVICES.seo)

export default function Page() {
  return <PortalMarketingPage look="audience" content={CAREER_SERVICES.content} />
}
