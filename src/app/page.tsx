import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { HomepageVisitTracker } from '@/components/marketing/HomepageVisitTracker'
import { StatCallouts } from '@/components/StatCallouts'
import { PERSONAS } from '@/lib/constants/personas'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'

// Exactly the three facts that are true of the product today, no usage/
// traction numbers — see the roadmap note on this component for why those
// are deferred until there's real volume worth showing honestly.
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

const STUCK_TO_FIX = [
  { stuck: "You don't know where you actually stand", fix: 'Current Market Reality' },
  { stuck: "You're overwhelmed and don't know what to do next", fix: 'Search Sprint' },
  { stuck: "You're isolated and don't have anyone to talk to about it", fix: 'Support Network' },
  { stuck: "You're applying and hearing nothing back", fix: 'Job Fit + recruiter matching' },
  { stuck: 'Your skills feel stale, or AI is changing what "qualified" means', fix: 'Learning' },
  { stuck: "You need income now and don't want a gap on your resume", fix: 'Interim & gig work' },
  {
    stuck: "You don't want to waste time applying to jobs that are black holes or don't even exist",
    fix: 'NextChapter Job Board & Recruiters',
  },
  { stuck: "Your resume doesn't show what actually makes you valuable", fix: 'Executive Dossier' },
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
    'NextChapter is a candidate-first hiring platform. Upload your resume, build a profile that shows how you actually work, and get a free Current Market Reality with a personalized action plan.',
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
      {/* Section 1 — Hero */}
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
              href="/for-coaches"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground lg:inline-block"
            >
              For coaches
            </Link>
            <Link
              href="/for-organizations"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-block"
            >
              For organizations
            </Link>
            <Button nativeButton={false} size="default" variant="success" render={<Link href="/auth/login" />}>
              Log in
            </Button>
          </nav>
        </div>

        <div className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-navy sm:text-6xl">
            NextChapter
          </h1>
          <p className="mt-2 text-lg font-medium text-muted-foreground sm:text-xl">
            Your Free Job Transition Platform
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            LinkedIn doesn&apos;t work. Job boards are a black hole. Get started with your
            Market Reality Report — we&apos;ll tell you exactly where you stand today, then give you
            a personalized action plan that actually gets you hired.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              nativeButton={false}
              size="lg"
              variant="cta"
              className="h-14 px-8 text-base"
              render={<Link href="/onboarding/desire" />}
            >
              Get your Market Reality Assessment
            </Button>
          </div>

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

      {/* Section 2 — Why you're stuck */}
      <section className="bg-off-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy">
            If the job search feels stuck, here&apos;s why — and how we fix it.
          </h2>
          <div className="mt-10 hidden justify-between px-6 sm:flex">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Problem</span>
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Solution</span>
          </div>
          <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-light-gray bg-white sm:mt-3">
            {STUCK_TO_FIX.map((row) => (
              <div key={row.stuck} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <p className="text-sm text-foreground">{row.stuck}</p>
                <p className="shrink-0 text-sm font-semibold text-brand sm:text-right">{row.fix}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Most outplacement programs give you a login and a PDF. We give you a plan that updates
            every week, and a profile that gets stronger every time someone vouches for you.
          </p>
          <div className="mt-6 text-center">
            <Link href="/why-stuck" className="text-sm font-medium text-primary underline underline-offset-4">
              See the full picture →
            </Link>
          </div>
        </div>
      </section>

      {/* Section 3 — Which one sounds like you */}
      <section className="bg-white py-20">
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

      {/* Section 4 — How it works */}
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

      {/* Section 5 — Know someone who needs this */}
      <section className="bg-white py-20">
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

      {/* Section 5a — Executive Coach teaser, links to the existing /coaching
          waitlist page rather than duplicating its form here */}
      <section className="bg-off-white py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-navy">Want a real human in your corner too?</h2>
          <p className="mt-3 text-muted-foreground">
            Victoria, your AI coach, stays free. Executive Coach adds a human career coach on
            top — mock interviews, resume review, a second opinion on hard calls.
          </p>
          <div className="mt-6">
            <Button nativeButton={false} size="default" variant="outline" render={<Link href="/coaching" />}>
              Learn more about Executive Coach
            </Button>
          </div>
        </div>
      </section>

      {/* Section 5b — product-fact stat callouts */}
      <section className="bg-off-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <StatCallouts stats={HOMEPAGE_STATS} />
        </div>
      </section>

      {/* Section 5c — guide links, deliberately low-key (SEO/GEO surface area,
          not a marketing CTA) */}
      <section className="bg-white py-10">
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

      {/* Section 6 — CTA footer */}
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
