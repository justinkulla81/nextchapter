import Link from 'next/link'
import { SiteNav } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { HomeTryIt } from '@/components/home/HomeTryIt'
import { JourneyPicker } from '@/components/home/JourneyPicker'
import { HomeLearnMore } from '@/components/home/HomeLearnMore'
import { HomeFunding } from '@/components/home/HomeFunding'
import { AiJobsStat } from '@/components/marketing/AiJobsStat'
import { AiExposureSection } from '@/components/marketing/AiExposureSection'
import { Suspense } from 'react'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'

// The redesigned homepage (docs/candidate-redesign.md page contract): one headline, one
// primary action, three sections (hero, jobs, what you get), then a row for everyone who
// is not job hunting and a footer. Every claim sits next to its reason.

const action =
  'inline-flex h-14 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95'

const AUDIENCES = [
  { label: 'Employers', href: '/employers' },
  { label: 'Recruiters', href: '/recruiters' },
  { label: 'Coaches', href: '/coaches' },
  { label: 'Colleges', href: '/higher-education' },
  { label: 'Nonprofits', href: '/nonprofits' },
  { label: 'Government and workforce', href: '/government-workforce' },
]

const FOOTER_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'News', href: '/news' },
  { label: 'Funding', href: '/funding' },
  { label: 'Resources', href: '/resources' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Plans', href: '/pricing' },
  { label: 'Security', href: '/security' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
]

// Keyword-owning pages (docs/seo/keyword-map.md), linked from the footer so the homepage passes its weight to each topic.
const TOPIC_LINKS = [
  { label: 'Laid off', href: '/start/laid-off' },
  { label: 'Layoff tracker', href: '/layoffs' },
  { label: 'Unemployment benefits', href: '/unemployment-benefits' },
  { label: 'Severance', href: '/topics/severance' },
  { label: 'Job search', href: '/jobs' },
  { label: 'Job search strategy', href: '/topics/job-search-strategy' },
  { label: 'Resume tips', href: '/topics/resume-tips' },
  { label: 'Career change', href: '/start/career-change' },
  { label: 'Career pivot', href: '/topics/career-pivot' },
  { label: 'Career exploration', href: '/topics/career-exploration' },
  { label: 'Career coach', href: '/coaching' },
  { label: 'Executive recruiters', href: '/topics/executive-recruiters' },
  { label: 'Reverse recruiter', href: '/topics/reverse-recruiter' },
  { label: 'Outplacement', href: '/outplacement' },
  { label: 'Severance calculator', href: '/tools/severance-calculator' },
  { label: 'Local job markets', href: '/places' },
  { label: 'Glossary', href: '/glossary' },
]

// The homepage test (src/lib/home-ab.ts): 'control' is the page as it was; 'picker' puts the journey picker's first question in
// the hero, under an outcome headline, and drops the separate "Not ready to sign up?" section (the picker is now up here).
// `variant` is also on every homepage_cta_clicked event, so PostHog can split them.
export type HomeVariantName = 'control' | 'picker'

export function NewHome({ variant = 'control' }: { variant?: HomeVariantName } = {}) {
  const picker = variant === 'picker'
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header>
        <SiteNav />
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-10 pb-16 text-center" aria-labelledby="home-hero-heading">
        <h1 id="home-hero-heading" className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl">
          {picker ? 'Find out why your job search is stalling, and what to fix first.' : 'Get hired faster, with a coach that knows your whole search.'}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          {picker
            ? 'Two clicks tell us where you are. You get a plan for your first week, free, with no résumé and no account.'
            : 'Your résumé is the least complete thing about you. NextChapter works from your applications, your networking and your learning, and tailors every step to you.'}
        </p>
        {picker && (
          <div className="mt-8 text-left">
            <JourneyPicker variant={variant} />
          </div>
        )}
        <div className="mt-8">
          <TrackedLink href={MARKET_REALITY_START_HREF} event="homepage_cta_clicked" properties={{ cta: 'hero_assessment', variant }} className={action}>
            Get your Market Reality Assessment
          </TrackedLink>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Free for candidates, always. Takes about five minutes.</p>
        {picker && (
          <p className="mt-2 text-sm">
            <TrackedLink href="/jobs" event="homepage_cta_clicked" properties={{ cta: 'hero_search_jobs', variant }} className="text-muted-foreground underline underline-offset-4">
              Just want to search jobs?
            </TrackedLink>
          </p>
        )}
        <p className="mx-auto mt-6 max-w-md text-sm text-muted-foreground">
          <span className="font-semibold text-ink">Why:</span> a hiring manager scores you on 15 things, and a résumé speaks to 2 of them.{' '}
          <Link href="/why-stuck" className="text-brand underline underline-offset-4">
            See the other 13
          </Link>
        </p>
      </section>

      {!picker && <HomeTryIt />}

      <section className="mx-auto max-w-3xl px-6 py-12 text-center" aria-label="How it works, in a video">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-white shadow-lg">
          <video
            controls
            // "none": "metadata" still pulled ~360 KB on load, delaying the hero text (LCP) on
            // mobile. The video loads when played.
            preload="none"
            className="w-full"
            src="https://uvoulytrsrxasqzutlmq.supabase.co/storage/v1/object/public/site-media/homepage-explainer.mp4"
          >
            Your browser doesn&apos;t support embedded video.
          </video>
        </div>
      </section>

      <Suspense fallback={null}>
        <AiJobsStat />
      </Suspense>

      <Suspense fallback={null}>
        <AiExposureSection page="home" cta={{ event: 'homepage_cta_clicked', properties: { cta: 'ai_exposure_assessment', variant }, className: action }} />
      </Suspense>

      <HomeFunding />

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
            <TrackedLink href={MARKET_REALITY_START_HREF} event="homepage_cta_clicked" properties={{ cta: 'footer_assessment', variant }} className={action}>
              Get your Market Reality Assessment
            </TrackedLink>
          </div>
          <nav aria-label="Topics" className="mt-12 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/80">
            {TOPIC_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="underline-offset-4 hover:text-white hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Footer" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/80">
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
