import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { COACHES } from '@/lib/marketing/portal-pages/coaches'
import { portalMetadata } from '@/lib/marketing/portal-seo'

export const metadata: Metadata = portalMetadata(COACHES.seo)

export default function CoachesPage() {
  return <PortalMarketingPage content={COACHES.content} />
}
