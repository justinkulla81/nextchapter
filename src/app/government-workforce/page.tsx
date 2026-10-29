import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { WorkforceNumbers } from '@/components/organizations/WorkforceNumbers'
import { WORKFORCE } from '@/lib/marketing/portal-pages/workforce'
import { portalMetadata } from '@/lib/marketing/portal-seo'

// The live numbers are cached for a day (src/lib/marketing/workforce-numbers.ts); rebuild hourly.
export const revalidate = 3600

export const metadata: Metadata = portalMetadata(WORKFORCE.seo)

export default function GovernmentWorkforcePage() {
  return <PortalMarketingPage look="audience" content={{ ...WORKFORCE.content, proof: { kind: 'live', node: <WorkforceNumbers page={WORKFORCE.content.analyticsKey} /> } }} />
}
