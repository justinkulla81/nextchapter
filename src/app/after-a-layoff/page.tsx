import type { Metadata } from 'next'
import { CandidateLanding } from '@/components/marketing/candidate-landing/CandidateLanding'
import { AFTER_LAYOFF_A, LANDING_SEO } from '@/lib/marketing/candidate-landing'
import { AFTER_LAYOFF_PATH } from '@/lib/after-layoff-ab'
import { canonical } from '@/lib/seo/canonical'

// Version A of the test in src/lib/after-layoff-ab.ts. The proxy sends a person assigned to B to /ab/after-layoff-b
// instead, at this same address. A paid-search page: kept out of the index so it does not compete with the state and
// persona pages that already rank for these searches.
export const revalidate = 3600

export const metadata: Metadata = {
  ...LANDING_SEO.after_a_layoff,
  ...canonical(AFTER_LAYOFF_PATH),
  robots: { index: false, follow: true },
}

export default function AfterALayoffPage() {
  return <CandidateLanding c={AFTER_LAYOFF_A} />
}
