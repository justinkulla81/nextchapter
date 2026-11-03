import type { Metadata } from 'next'
import { CandidateLanding } from '@/components/marketing/candidate-landing/CandidateLanding'
import { AFTER_LAYOFF_B, LANDING_SEO } from '@/lib/marketing/candidate-landing'
import { AFTER_LAYOFF_PATH } from '@/lib/after-layoff-ab'
import { canonical } from '@/lib/seo/canonical'

// Version B of the test in src/lib/after-layoff-ab.ts. Reached only through the proxy's rewrite from /after-a-layoff, so
// the visible address is /after-a-layoff. Opened directly it is noindex with that page as its canonical.
export const revalidate = 21600 // 6 hours: was hourly; every regeneration is a billed ISR write

export const metadata: Metadata = {
  ...LANDING_SEO.after_a_layoff,
  ...canonical(AFTER_LAYOFF_PATH),
  robots: { index: false, follow: true },
}

export default function AfterLayoffVariantB() {
  return <CandidateLanding c={AFTER_LAYOFF_B} />
}
