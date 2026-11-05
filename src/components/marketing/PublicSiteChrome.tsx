import { SiteNavMega } from './SiteNavMega'
import { SiteFooterColumns } from './SiteFooterColumns'
import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { COMPANY_ADDRESS, COMPANY_BLUESKY_URL, COMPANY_LINKEDIN_URL, COMPANY_X_URL } from '@/lib/contact/constants'
import { FooterAsk } from './FooterAsk'

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
      <div className="pt-12">
        <SiteFooterColumns tone="dark" />
      </div>
      <div className={`mx-auto max-w-4xl px-6 text-center ${cta ? 'py-16' : 'py-10'}`}>
        {cta && <FooterAsk page={page} />}
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
