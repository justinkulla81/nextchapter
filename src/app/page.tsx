import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'

const heroStats = [
  { value: '25%', label: 'Lifetime earnings cut after 27+ weeks unemployed' },
  { value: '24.2%', label: 'Professionals stuck in a mid-career stall' },
  { value: '15–20%', label: 'Pay cut after an AI-driven layoff' },
  { value: '8%', label: 'Lower household wealth, 6 years after a layoff' },
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
            <Button size="default" variant="success" render={<Link href="/auth/login" />}>
              Log in
            </Button>
          </nav>
        </div>

        <div className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-navy sm:text-6xl">
            Find out what&apos;s holding back your <span className="whitespace-nowrap">job search.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Get an honest Hireability Grade and a personalized action plan that actually gets you
            hired — not another job board, not another LinkedIn stigma.
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

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/why-stuck"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Why you&apos;re stuck
            </Link>
            <span className="hidden text-muted-foreground sm:inline">·</span>
            <Link
              href="/how-it-works"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              See how it works
            </Link>
          </div>
        </div>

        <div className="h-1.5 w-full bg-orange" />
      </section>

      {/* Section 2 — CTA footer */}
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
              render={<Link href="/onboarding/resume" />}
            >
              Get your Hireability score and then action plan to start your next chapter
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
