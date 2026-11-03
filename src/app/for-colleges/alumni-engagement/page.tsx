import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { ENGAGEMENT } from '@/lib/marketing/portal-pages/for-colleges'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(ENGAGEMENT.seo)

export default function Page() {
  return <PortalMarketingPage look="audience" content={ENGAGEMENT.content} />
}
