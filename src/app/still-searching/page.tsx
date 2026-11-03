import type { Metadata } from 'next'
import { CandidateLanding } from '@/components/marketing/candidate-landing/CandidateLanding'
import { LANDING_SEO, STILL_SEARCHING } from '@/lib/marketing/candidate-landing'
import { canonical } from '@/lib/seo/canonical'

// The paid-search page for candidates out of work for months. Not part of the after-a-layoff test: a different person
// with a different question. Kept out of the index, like the other ad pages, because https://launchyournextchapter.com/start/searching-too-long
// already serves that search.
export const revalidate = 21600 // 6 hours: was hourly; every regeneration is a billed ISR write

export const metadata: Metadata = {
  ...LANDING_SEO.still_searching,
  ...canonical('/still-searching'),
  robots: { index: false, follow: true },
}

export default function StillSearchingPage() {
  return <CandidateLanding c={STILL_SEARCHING} />
}
