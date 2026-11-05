import { SiteNavMega } from './SiteNavMega'
import { SiteFooterColumns } from './SiteFooterColumns'
import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { COMPANY_ADDRESS, COMPANY_BLUESKY_URL, COMPANY_LINKEDIN_URL, COMPANY_X_URL } from '@/lib/contact/constants'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { AssessmentCtaLabel } from '@/components/ab/AssessmentCtaLabel'
import { StartLink } from '@/components/onboarding/StartLink'

/**
 * The public site's top navigation — the homepage uses this same component,
 * so every public page shows identical links. The menus are in src/lib/nav/public-nav.ts.
 */
export function SiteNav(_props: { current?: 'about' | 'news' | 'reports' } = {}) {
  return <SiteNavMega />
}

/** The homepage's header, for public pages that stand on their own (About, Contact). */
export function PublicSiteHeader({ current }: { current?: 'about' | 'contact' | 'news' | 'reports' | 'careers' }) {
  return (
    <header className="bg-white">
      <SiteNav current={current === 'about' || current === 'news' || current === 'reports' ? current : undefined} />
    </header>
  )
}

/** The homepage's closing band and footer links, with About and Contact. */
export function PublicSiteFooter({ page, cta = true }: { cta?: boolean; page: 'about' | 'contact' | 'news' | 'reports' | 'authors' | 'editorial' | 'layoffs' | 'benefits' | 'scam-watch' | 'careers' | 'ai-skills' | 'ai-training' | 'funding' | 'seo' }) {
  return (
    <footer className="bg-navy text-white">
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <NewsletterSignup source="site-footer" variant="compact" />
        </div>
      </div>
      <div className="pt-12">
        <SiteFooterColumns tone="dark" />
      </div>
      <div className={`mx-auto max-w-4xl px-6 text-center ${cta ? 'py-16' : 'py-10'}`}>
        {cta && (<>
        <h2 className="text-3xl font-bold tracking-tight">{page === 'seo' ? 'Still guessing what to do next?' : 'Is your own search stuck?'}</h2>
        <p className="mx-auto mt-4 max-w-xl text-light-blue">
          {page === 'seo' ? 'Free to join, always. Organizations, let’s talk.' : 'Answer a few questions and get a plain-language read on your market, matched jobs and a weekly plan. Free for Members, no résumé needed. Organizations, let’s talk.'}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <StartLink
            href={MARKET_REALITY_START_HREF}
            source={`footer_${page}`}
            event="about_cta_clicked"
            properties={{ cta: 'footer_get_grade', page }}
            className="inline-flex items-center justify-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95"
          >
            {page === 'seo' ? <AssessmentCtaLabel>Get your Market Reality Assessment</AssessmentCtaLabel> : 'Yes, build my plan'}
          </StartLink>
          <TrackedLink
            href="/contact"
            event="about_cta_clicked"
            properties={{ cta: 'footer_contact', page }}
            className="inline-flex items-center justify-center rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Contact us
          </TrackedLink>
        </div>
        </>)}
        <p className={`${cta ? 'mt-10 ' : ''}text-sm text-light-blue`}>
          © {new Date().getFullYear()} NextChapter
          {' · '}<Link href="/about" className="underline underline-offset-4">About</Link>
          {' · '}<Link href="/contact" className="underline underline-offset-4">Contact</Link>
          {' · '}<Link href="/careers" className="underline underline-offset-4">Careers</Link>
          {' · '}<Link href="/pricing" className="underline underline-offset-4">Plans</Link>
          {' · '}<Link href="/security" className="underline underline-offset-4">Security</Link>
          {' · '}<Link href="/scam-watch" className="underline underline-offset-4">Scam watch</Link>
          {' · '}<Link href="/news" className="underline underline-offset-4">News</Link>
          {' · '}<Link href="/layoffs" className="underline underline-offset-4">Layoff tracker</Link>
          {' · '}<Link href="/places" className="underline underline-offset-4">Local job markets</Link>
          {' · '}<Link href="/reports/latest" className="underline underline-offset-4">White Collar Employment Report</Link>
          {' · '}<Link href="/ai-courses" className="underline underline-offset-4">AI courses</Link>
          {' · '}<Link href="/ai-skills" className="underline underline-offset-4">AI skills data</Link>
          {' · '}<Link href="/press" className="underline underline-offset-4">Press and data</Link>
          {' · '}<Link href="/faq" className="underline underline-offset-4">FAQ</Link>
          {' · '}<Link href="/editorial-standards" className="underline underline-offset-4">Editorial standards</Link>
          {' · '}<Link href="/privacy-policy" className="underline underline-offset-4">Privacy Policy</Link>
          {' · '}<Link href="/terms" className="underline underline-offset-4">Terms of Service</Link>
          {' · '}
          <TrackedLink href={COMPANY_LINKEDIN_URL} event="company_linkedin_clicked" properties={{ page, placement: 'footer' }} className="underline underline-offset-4">
            LinkedIn
          </TrackedLink>
          {' · '}
          <TrackedLink href={COMPANY_BLUESKY_URL} event="company_social_clicked" properties={{ network: 'bluesky', page, placement: 'footer' }} ariaLabel="NextChapter on Bluesky" className="underline underline-offset-4">
            Bluesky
          </TrackedLink>
          {' · '}
          <TrackedLink href={COMPANY_X_URL} event="company_social_clicked" properties={{ network: 'x', page, placement: 'footer' }} ariaLabel="NextChapter on X" className="underline underline-offset-4">
            X
          </TrackedLink>
        </p>
        <p className="mt-3 text-sm text-light-blue">NextChapter · {COMPANY_ADDRESS}</p>
      </div>
    </footer>
  )
}
