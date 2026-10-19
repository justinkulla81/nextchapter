import Link from 'next/link'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { HomepageJobBoard } from '@/components/home/HomepageJobBoard'
import { HomeLearnMore } from '@/components/home/HomeLearnMore'

// The redesigned homepage (docs/candidate-redesign.md page contract): one headline, one
// primary action, three sections (hero, jobs, what you get), then a row for everyone who
// is not job hunting and a footer. Every claim sits next to its reason.

const action =
  'inline-flex h-14 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95'

const AUDIENCES = [
  { label: 'Employers', href: '/outplacement' },
  { label: 'Recruiters', href: '/recruiters' },
  { label: 'Coaches', href: '/coaches' },
  { label: 'Colleges and nonprofits', href: '/nonprofits' },
  { label: 'Government and workforce', href: '/government-workforce' },
]

const FOOTER_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'News', href: '/news' },
  { label: 'Resources', href: '/resources' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Security', href: '/security' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
]

export function NewHome() {
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header>
        <SiteNav />
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-10 pb-16 text-center" aria-labelledby="home-hero-heading">
        <h1 id="home-hero-heading" className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl">
          Get hired faster, with a coach that knows your whole search.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Your résumé is the least complete thing about you. NextChapter works from your applications, your networking and your learning,
          and tailors every step to you.
        </p>
        <div className="mt-8">
          <TrackedLink href="/onboarding/desire" event="homepage_cta_clicked" properties={{ cta: 'hero_assessment' }} className={action}>
            Get your Market Reality Assessment
          </TrackedLink>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Free for candidates, always. Takes about five minutes.</p>
        <p className="mx-auto mt-6 max-w-md text-sm text-muted-foreground">
          <span className="font-semibold text-ink">Why:</span> a hiring manager scores you on 15 things, and a résumé speaks to 2 of them.{' '}
          <Link href="/why-stuck" className="text-brand underline underline-offset-4">
            See the other 13
          </Link>
        </p>
      </section>

      <HomepageJobBoard />

      <HomeLearnMore />

      <section className="bg-white pb-16" aria-label="For organizations">
        <p className="mx-auto max-w-3xl px-6 text-center text-base text-muted-foreground">
          Not job hunting? NextChapter is also for{' '}
          {AUDIENCES.map((a, i) => (
            <span key={a.href}>
              <Link href={a.href} className="font-medium text-brand underline underline-offset-4">
                {a.label}
              </Link>
              {i < AUDIENCES.length - 2 ? ', ' : i === AUDIENCES.length - 2 ? ' and ' : '.'}
            </span>
          ))}{' '}
          <Link href="/for-organizations" className="font-semibold text-ink underline underline-offset-4">
            See all
          </Link>
        </p>
      </section>

      <footer className="bg-ink text-white">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance">Ready to start your next chapter?</h2>
          <div className="mt-6">
            <TrackedLink href="/onboarding/desire" event="homepage_cta_clicked" properties={{ cta: 'footer_assessment' }} className={action}>
              Get your Market Reality Assessment
            </TrackedLink>
          </div>
          <nav aria-label="Footer" className="mt-12 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/80">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="underline-offset-4 hover:text-white hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="mt-4 text-xs text-white/60">© {new Date().getFullYear()} NextChapter. Candidates are never charged.</p>
        </div>
      </footer>
    </div>
  )
}
