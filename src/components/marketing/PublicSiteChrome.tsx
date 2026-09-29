import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { COMPANY_LINKEDIN_URL } from '@/lib/contact/constants'

const NAV_LINK = 'hidden text-sm font-medium text-muted-foreground hover:text-foreground'

/** The homepage's header, for public pages that stand on their own (About, Contact). */
export function PublicSiteHeader({ current }: { current?: 'about' | 'contact' }) {
  return (
    <header className="border-b border-light-gray bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link href="/" aria-label="NextChapter home">
          <Logo className="text-3xl" />
        </Link>
        <nav className="flex items-center gap-6" aria-label="Main">
          <Link href="/how-it-works" className={`${NAV_LINK} sm:inline-block`}>How it works</Link>
          <Link href="/about" aria-current={current === 'about' ? 'page' : undefined} className={`${NAV_LINK} lg:inline-block ${current === 'about' ? 'text-navy' : ''}`}>About</Link>
          <Link href="/contact" aria-current={current === 'contact' ? 'page' : undefined} className={`${NAV_LINK} lg:inline-block ${current === 'contact' ? 'text-navy' : ''}`}>Contact</Link>
          <Link href="/for-organizations" className="hidden text-sm font-semibold text-brand hover:text-navy sm:inline-block">For organizations →</Link>
          <Button nativeButton={false} size="default" variant="success" render={<Link href="/auth/login" />}>
            Log in
          </Button>
        </nav>
      </div>
    </header>
  )
}

/** The homepage's closing band and footer links, with About and Contact. */
export function PublicSiteFooter({ page }: { page: 'about' | 'contact' }) {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Ready to start your next chapter?</h2>
        <p className="mx-auto mt-4 max-w-xl text-light-blue">
          Candidates are never charged. Organizations, let’s talk.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <TrackedLink
            href="/onboarding/desire"
            event="about_cta_clicked"
            properties={{ cta: 'footer_get_grade', page }}
            className="inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover"
          >
            Get your Market Reality Grade
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
        <p className="mt-10 text-sm text-light-blue">
          © {new Date().getFullYear()} NextChapter
          {' · '}<Link href="/about" className="underline underline-offset-4">About</Link>
          {' · '}<Link href="/contact" className="underline underline-offset-4">Contact</Link>
          {' · '}<Link href="/pricing" className="underline underline-offset-4">Pricing</Link>
          {' · '}<Link href="/security" className="underline underline-offset-4">Security</Link>
          {' · '}<Link href="/faq" className="underline underline-offset-4">FAQ</Link>
          {' · '}<Link href="/privacy-policy" className="underline underline-offset-4">Privacy Policy</Link>
          {' · '}
          <TrackedLink href={COMPANY_LINKEDIN_URL} event="company_linkedin_clicked" properties={{ page, placement: 'footer' }} className="underline underline-offset-4">
            LinkedIn
          </TrackedLink>
        </p>
      </div>
    </footer>
  )
}
