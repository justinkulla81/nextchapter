import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { GIVING } from '@/lib/marketing/portal-pages/for-colleges'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(GIVING.seo)

export default function Page() {
  return <PortalMarketingPage look="audience" content={GIVING.content} />
}
