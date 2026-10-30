import type { Metadata } from 'next'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { RapidResponseBand } from '@/components/marketing/RapidResponseBand'
import { RapidResponseNumbers } from '@/components/organizations/RapidResponseNumbers'
import { RAPID_RESPONSE } from '@/lib/marketing/portal-pages/rapid-response'
import { portalMetadata } from '@/lib/marketing/portal-seo'

// One cached page for everyone, rebuilt daily like the layoff tracker it reads. The personal line is added in the
// browser by RapidResponseBand, so the page stays fast and never varies by visitor on the server.
export const revalidate = 86400

export const metadata: Metadata = portalMetadata(RAPID_RESPONSE.seo)

export default function ForRapidResponsePage() {
  return (
    <PortalMarketingPage
      look="audience"
      content={{
        ...RAPID_RESPONSE.content,
        proof: {
          kind: 'live',
          node: (
            <>
              <RapidResponseBand />
              <RapidResponseNumbers />
            </>
          ),
        },
      }}
    />
  )
}
