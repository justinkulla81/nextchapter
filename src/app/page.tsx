import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { HomepageVisitTracker } from '@/components/marketing/HomepageVisitTracker'
import { StatCallouts } from '@/components/StatCallouts'
import { CompetencyGridVisual } from '@/components/marketing/CompetencyGridVisual'
import { SampleMarketRealityReport } from '@/components/marketing/SampleMarketRealityReport'
import { AudienceRouter } from '@/components/marketing/AudienceRouter'
import { PERSONAS } from '@/lib/constants/personas'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'

// Partners Master Build Script §C3.1 — homepage restructured to the spec's
// exact 8-part order: hero -> the problem in one screen -> the three beats
// -> proof of the diagnosis -> the Dossier -> "Free, always" -> audience
// router -> waitlist/signup. Existing high-value content (heroStats,
// "which one sounds like you," the STUCK_TO_FIX table, the how-it-works
// steps, and the guide links) is folded in around that spine rather than
// deleted — this is a restructure, not a rebuild.
const HOMEPAGE_STATS = [
  { value: '15', label: 'Free expert guides' },
  { value: 'Free', label: 'For candidates, always' },
  { value: '4', label: 'Step verified process' },
]

const heroStats = [
  { value: '25%', label: 'Lifetime earnings cut after 27+ weeks unemployed' },
  { value: '24.2%', label: 'Professionals stuck in a mid-career stall' },
  { value: '15–20%', label: 'Pay cut after an AI-driven layoff' },
  { value: '8%', label: 'Lower household wealth, 6 years after a layoff' },
]

const THREE_BEATS = [
  {
    title: 'Know where you stand.',
    body: 'A Market Reality Grade that tells you how hard this search will be and which of the five things driving it are in your control. Not a judgment of your career — an estimate of the work ahead.',
    href: '/why-stuck',
    cta: 'See the full picture →',
  },
  {
    title: "Fix what's fixable.",
    body: 'Your resume tested against the eleven systems that actually read it. Every issue, with the fix, in about twenty minutes.',
    href: '/how-it-works',
    cta: 'See how it works →',
  },
  {
    title: "Build what your resume can't say.",
    body: 'Five references, structured and scored. Two validated assessments. One Executive Dossier you keep forever.',
    href: '/dossier',
    cta: 'See a sample Dossier →',
  },
]

const HOW_IT_WORKS_STEPS = [
  { title: 'Current Market Reality', description: 'A clearer view of where you stand and what to do next.' },
  { title: 'Search Sprint', description: 'A clear weekly plan, not a guessing game.' },
  { title: 'Weekly Search Score', description: 'Momentum you can actually see, points that never feel abstract.' },
  { title: 'Executive Dossier', description: 'Helps employers see what your résumé leaves out.' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'NextChapter',
  url: 'https://launchyournextchapter.com',
  description:
    'A resume is the least complete thing about you. NextChapter turns a job search into verified evidence — a Market Reality Grade, a Resume Studio, and an Executive Dossier corroborated by the people who worked with you. Free for candidates, always.',
  publisher: {
    '@type': 'Organization',
    name: 'NextChapter',
    url: 'https://launchyournextchapter.com',
  },
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <HomepageVisitTracker />

      {/* 1 — Hero (§C3.1.1) */}
      <section className="relative bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Logo className="text-3xl" />
          <nav className="flex items-center gap-6">
            <Link
              href="/why-stuck"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground lg:inline-block"
            >
              Why you&apos;re stuck
            </Link>
            <Link
              href="/how-it-works"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-block"
            >
              How it works
            </Link>
            <Link
              href="/coaches"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground lg:inline-block"
            >
              For coaches
            </Link>
            <Link
              href="/employers"
              className="hidden text-sm font-semibold text-brand hover:text-navy sm:inline-block"
            >
              For employers →
            </Link>
            <Button nativeButton={false} size="default" variant="success" render={<Link href="/auth/login" />}>
              Log in
            </Button>
          </nav>
        </div>

        <div className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-navy sm:text-6xl">
            Your resume is the least complete thing about you.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            NextChapter shows you exactly how the market reads your search — then helps you build the
            evidence that changes it.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              nativeButton={false}
              size="lg"
              variant="cta"
              className="h-14 px-8 text-base"
              render={<Link href="/onboarding/desire" />}
            >
              Get Your Market Reality Grade
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            See how hiring managers will read your resume, and get a plan to increase your marketability.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Hiring, recruiting, or coaching instead?{' '}
            <Link href="/for-organizations" className="font-medium text-brand underline underline-offset-4">
              Find your path →
            </Link>
          </p>

          <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
            <video
              controls
              preload="metadata"
              className="w-full"
              src="https://uvoulytrsrxasqzutlmq.supabase.co/storage/v1/object/public/site-media/homepage-explainer.mp4"
            >
              Your browser doesn&apos;t support embedded video.
            </video>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-4">
            {heroStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-light-gray bg-off-white px-4 py-6 text-center"
              >
                <p className="text-2xl font-bold text-navy">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="h-1.5 w-full bg-orange" />
      </section>

      {/* 2 — The problem, in one screen (§C3.1.2) */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-navy">
            A hiring manager scores you on 15 things. Your resume can only speak to 2 of them.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Five competencies, checked three ways each — by your references, by a real assessment, and by
            what you actually do. Here&apos;s what a resume alone actually covers.
          </p>
          <div className="mt-10">
            <CompetencyGridVisual />
          </div>
        </div>
      </section>

      {/* 3 — The three beats (§C2.1 / §C3.1.3) */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy">
            NextChapter closes that gap in three moves.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {THREE_BEATS.map((beat) => (
              <div key={beat.title} className="rounded-xl border border-light-gray bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-navy">{beat.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{beat.body}</p>
                <Link href={beat.href} className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4">
                  {beat.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Which one sounds like you — existing high-converting persona picker,
          kept as a bridge between the beats and the proof section. */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-navy">Which one sounds like you?</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PERSONAS.map((persona) => (
              <Link
                key={persona.slug}
                href={`/start/${persona.slug}`}
                className="group flex items-start justify-between gap-3 rounded-xl border border-light-gray bg-white p-6 text-left shadow-sm transition-all hover:border-brand hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-navy">{persona.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{persona.hook}</p>
                </div>
                <span
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-lg text-brand transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — Proof of the diagnosis (§C3.1.4) */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-navy">A real report, not a description of one.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            This is the same component a candidate sees on their dashboard — fed with sample data for a
            fictional candidate so you can see exactly what you&apos;d get.
          </p>
          <div className="mt-10">
            <SampleMarketRealityReport />
          </div>
        </div>
      </section>

      {/* 5 — The Dossier (§C3.1.5) */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-navy">The Executive Dossier</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Five structured references. Two validated assessments. One document, built once, that you
            control and keep forever — through this search and every one after it.
          </p>
          <div className="mt-6">
            <Button nativeButton={false} size="default" variant="outline" render={<Link href="/dossier" />}>
              See a sample Dossier
            </Button>
          </div>
        </div>
      </section>

      {/* 6 — "Free, always" (§C3.1.6) */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-navy">Free, always.</h2>
          <p className="mt-3 text-muted-foreground">
            The Market Reality Report, Resume Studio, job matching, community, and company pages cost
            nothing — permanently, not a trial. Someone who just lost a job doesn&apos;t need a paywall,
            they need a plan.
          </p>
        </div>
      </section>

      {/* How it works — supplementary detail on the free product */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy">A clear path, not a black hole.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <div key={step.title} className="rounded-xl border border-light-gray bg-white p-6">
                <span className="text-xs font-semibold tracking-widest text-brand uppercase">Step {i + 1}</span>
                <h3 className="mt-1 font-semibold text-navy">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
            <Image
              src="/marketing/success-dashboard.png"
              alt="NextChapter Success Dashboard showing a Current Market Reality of B, an A Weekly Search Score, a 12-day streak, and completed Search Actions with their point values"
              width={1040}
              height={815}
              className="w-full"
            />
          </div>

          <div className="mt-6 text-center">
            <Link href="/how-it-works" className="text-sm font-medium text-primary underline underline-offset-4">
              See how it works in full →
            </Link>
          </div>
        </div>
      </section>

      {/* 7 — Audience router (§C3.1.7) */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy">
            Hiring, recruiting, or coaching?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            NextChapter isn&apos;t only for candidates. Find your path.
          </p>
          <div className="mt-10">
            <AudienceRouter />
          </div>
        </div>
      </section>

      <section className="bg-off-white py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-navy">
            Someone you care about is going through this.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Give them a head start — NextChapter is free for candidates, always.
          </p>
          <div className="mt-6">
            <Button nativeButton={false} size="default" variant="outline" render={<Link href="/refer" />}>
              Refer someone
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <StatCallouts stats={HOMEPAGE_STATS} />
        </div>
      </section>

      <section className="bg-off-white py-10">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Guides</h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {GUIDE_LANDING_CONTENT.map((guide) => (
              <Link
                key={guide.slug}
                href={`/resources/${guide.slug}`}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {guide.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 8 — Waitlist / signup (§C3.1.8). The product is live for
          candidates, so per §C4.2 this is a direct signup CTA, not a
          waitlist — a waitlist for a free, already-live product is friction
          with no purpose. */}
      <footer className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready to start your next chapter?</h2>
          <p className="mx-auto mt-4 max-w-xl text-light-blue">
            Does something need to change? Are you ready to put in the work?
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="cta"
              className="h-auto max-w-full py-3 whitespace-normal"
              nativeButton={false}
              render={<Link href="/onboarding/desire" />}
            >
              Get your Market Reality Grade and then action plan to start your next chapter
            </Button>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-light-blue">
            <span className="font-medium">Hiring, recruiting, or coaching?</span>
            <Link href="/for-organizations" className="underline underline-offset-4">
              See how NextChapter works for organizations
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-light-blue">
            <span className="font-medium">Already have a resume ready?</span>
            <Link href="/submit-resume" className="underline underline-offset-4">
              Get it in front of our recruiter network
            </Link>
          </div>
          <p className="mt-4 text-sm text-light-blue">
            © {new Date().getFullYear()} NextChapter. Candidates are never charged — ever.
            {' · '}
            <Link href="/pricing" className="underline underline-offset-4">
              Pricing
            </Link>
            {' · '}
            <Link href="/security" className="underline underline-offset-4">
              Security
            </Link>
            {' · '}
            <Link href="/faq" className="underline underline-offset-4">
              FAQ
            </Link>
            {' · '}
            <Link href="/resources" className="underline underline-offset-4">
              Resources
            </Link>
            {' · '}
            <Link href="/privacy-policy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
