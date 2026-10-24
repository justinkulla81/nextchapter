import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { NONPROFITS } from '@/lib/marketing/portal-pages/nonprofits'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(NONPROFITS.seo)

export default function NonprofitsPage() {
  return <PortalMarketingPage content={NONPROFITS.content} />
}
