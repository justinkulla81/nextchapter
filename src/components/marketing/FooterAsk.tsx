'use client'

import { TrackedLink } from '@/components/marketing/TrackedLink'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { AssessmentCtaLabel } from '@/components/ab/AssessmentCtaLabel'
import { useNavSession } from '@/lib/nav/use-nav-session'

/**
 * The footer's registration band. The page is cached for everyone, so it renders for signed-out visitors first; a signed-in member
 * has nothing to register for, so the band goes away for them (the page's box already offers them Personalize).
 */
export function FooterAsk({ page }: { page: string }) {
  const session = useNavSession()
  if (session?.signedIn) return null
  const seo = page === 'seo'
  return (
    <>
      <h2 className="text-3xl font-bold tracking-tight">{seo ? 'Still guessing what to do next?' : 'Is your own search stuck?'}</h2>
      <p className="mx-auto mt-4 max-w-xl text-light-blue">
        {seo ? 'Free to join, always. Organizations, let’s talk.' : 'Answer a few questions and get a plain-language read on your market, matched jobs and a weekly plan. Free for Members, no résumé needed. Organizations, let’s talk.'}
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <TrackedLink
          href={MARKET_REALITY_START_HREF}
          event="about_cta_clicked"
          properties={{ cta: 'footer_get_grade', page }}
          className="inline-flex items-center justify-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95"
        >
          {seo ? <AssessmentCtaLabel>Get your Market Reality Assessment</AssessmentCtaLabel> : 'Yes, build my plan'}
        </TrackedLink>
        <TrackedLink
          href="/contact"
          event="about_cta_clicked"
          properties={{ cta: 'footer_contact', page }}
          className="inline-flex items-center justify-center rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          Contact us
        </TrackedLink>
      </div>
    </>
  )
}
