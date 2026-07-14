import Link from 'next/link'
import Image from 'next/image'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'

const heroStats = [
  { value: '25%', label: 'Lifetime earnings cut after 27+ weeks unemployed' },
  { value: '24.2%', label: 'Professionals stuck in a mid-career stall' },
  { value: '15–20%', label: 'Pay cut after an AI-driven layoff' },
  { value: '8%', label: 'Lower household wealth, 6 years after a layoff' },
]

const candidatePainPoints = [
  'Applications vanish into a void — zero feedback, zero humanity',
  'LinkedIn is a performance stage, not an honest marketplace',
  'ATS filters them out before a human reads their name',
  'Employment gaps are penalized regardless of reason',
  'No way to show who they actually are',
]

const employerPainPoints = [
  'LinkedIn Recruiter costs $10K+/yr and yields passive, unserious leads',
  'ATS was built for compliance, not for finding great people',
  'Resumes are a commodity — everyone looks identical',
  'Culture fit is a guess — no tools exist to measure it pre-hire',
  'Best candidates never apply — they’re poached through networks',
]

const profiles = [
  { icon: '\u{1F499}', name: 'The Caregiver', description: 'Stepped away for family. Penalized for it.' },
  { icon: '⚡', name: 'Layoff Survivor', description: 'Random math, not performance.' },
  { icon: '→', name: 'The Relocator', description: 'Moved for family. Reads as unstable.' },
  { icon: '\u{1F680}', name: 'Career Pivoter', description: 'Expert choosing to start fresh.' },
  { icon: '\u{1F393}', name: 'Hungry Graduate', description: 'No experience, massive potential.' },
]

const whatWeDoItems = [
  {
    title: 'An honest mirror',
    description:
      'We tell you exactly how you come across to employers — the good and the hard-to-hear — so nothing quietly costs you an offer.',
  },
  {
    title: 'A resume that works',
    description: 'Specific, line-by-line feedback on what to fix first — not a generic template.',
  },
  {
    title: 'A real network plan',
    description: 'Who to reach out to and what to say — most jobs come from people, not postings.',
  },
  {
    title: 'Interview & negotiation prep',
    description:
      'Practice for the questions you’ll actually get asked, and a script for asking for what you’re worth.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'NextChapter',
  url: 'https://launchyournextchapter.com',
  description:
    'NextChapter is a candidate-first hiring platform. Upload your resume, build a profile that shows how you actually work, and get a free Hireability Grade with a personalized action plan.',
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
      {/* Section 1 — Hero */}
      <section className="relative bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Logo className="text-3xl" />
          <nav className="flex items-center gap-6">
            <Link
              href="/for-organizations"
              className="hidden text-sm text-muted-foreground/70 hover:text-muted-foreground sm:inline-block"
            >
              For organizations
            </Link>
            <Link href="/faq" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              FAQ
            </Link>
            <Button size="default" variant="success" render={<Link href="/auth/login" />}>
              Log in
            </Button>
          </nav>
        </div>

        <div className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-navy sm:text-6xl">
            Welcome to your <span className="whitespace-nowrap">Next Chapter</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Are you unemployed — or scared you&apos;re about to be? We&apos;re the only employment
            site built to actually get people back to work. We&apos;re not a job board where
            postings are a black hole. We&apos;re not LinkedIn, where &quot;Open to Work&quot; is a
            stigma. We help you see exactly where you stand with our Hireability Assessment, then
            build an action plan that actually gets you hired.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="cta" render={<Link href="/onboarding/resume" />}>
              Get your Hireability Assessment
            </Button>
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

      {/* Section 2 — The Problem */}
      <section className="grid sm:grid-cols-2">
        <div className="bg-off-white px-6 py-16 sm:px-10">
          <h2 className="text-sm font-semibold tracking-wide text-orange uppercase">
            Candidates say
          </h2>
          <ul className="mt-6 space-y-4">
            {candidatePainPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <X className="mt-0.5 size-4 shrink-0 text-orange" />
                <span className="text-base leading-relaxed text-foreground">{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white px-6 py-16 sm:px-10">
          <h2 className="text-sm font-semibold tracking-wide text-brand uppercase">
            Employers say
          </h2>
          <ul className="mt-6 space-y-4">
            {employerPainPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <X className="mt-0.5 size-4 shrink-0 text-brand" />
                <span className="text-base leading-relaxed text-foreground">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 3 — The Five Profiles */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          The market punishes great candidates. NextChapter doesn&apos;t.
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {profiles.map((profile) => (
            <Card key={profile.name}>
              <CardContent className="pt-6 text-center">
                <span className="text-3xl">{profile.icon}</span>
                <h3 className="mt-3 font-semibold">{profile.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{profile.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mx-auto mt-12 max-w-3xl rounded-xl border border-light-gray bg-off-white px-8 py-8 text-center">
          <p className="text-lg leading-relaxed text-foreground">
            Your Hireability Grade shows you exactly where you stand today. Then your action plan
            shows you exactly what to do next — so you walk into your next opportunity as strong
            as you can be.
          </p>
        </div>
      </section>

      {/* Section 3.5 — Success Dashboard preview */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">Your progress, always in view</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Your Success Dashboard tracks your Hireability Grade climbing in real time, with an
            action plan that tells you exactly what to do next.
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
          <Image
            src="/marketing/success-dashboard.png"
            alt="NextChapter Success Dashboard showing a Hireability Grade trending upward, with an action plan"
            width={2404}
            height={1762}
            className="w-full"
          />
        </div>
      </section>

      {/* Section 4 — What We Do */}
      <section className="border-t border-border bg-off-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">What we actually do for you</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              No jargon, no upsells — just an honest plan. It&apos;s the kind of guidance an
              executive recruiter charges thousands of dollars for. Yours is free, because we
              never charge candidates.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {whatWeDoItems.map((item) => (
              <Card key={item.title}>
                <CardContent className="pt-6 text-center">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6 — CTA footer */}
      <footer className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready to start your next chapter?</h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="cta"
              className="h-auto max-w-full py-3 whitespace-normal"
              render={<Link href="/onboarding/resume" />}
            >
              Get your Hireability score and then action plan to start your next chapter
            </Button>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-light-blue">
            <span className="font-medium">For organizations:</span>
            <Link href="/employers" className="underline underline-offset-4">
              Employers
            </Link>
            <Link href="/recruiters" className="underline underline-offset-4">
              Recruiters
            </Link>
            <Link href="/outplacement" className="underline underline-offset-4">
              Outplacement
            </Link>
            <Link href="/government-workforce" className="underline underline-offset-4">
              Government & Workforce
            </Link>
            <Link href="/nonprofits" className="underline underline-offset-4">
              Nonprofits & Academia
            </Link>
          </div>
          <p className="mt-4 text-sm text-light-blue">
            © {new Date().getFullYear()} NextChapter. Candidates are never charged — ever.
            {' · '}
            <Link href="/faq" className="underline underline-offset-4">
              FAQ
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
