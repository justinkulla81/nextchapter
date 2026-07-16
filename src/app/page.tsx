import Link from 'next/link'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { SituationalButtons } from '@/components/home/SituationalButtons'
import { HowItWorks } from '@/components/home/HowItWorks'
import { ByTheNumbers } from '@/components/home/ByTheNumbers'
import { SampleReportPreview } from '@/components/home/SampleReportPreview'

const heroStats = [
  { value: '25%', label: 'Lifetime earnings cut after 27+ weeks unemployed' },
  { value: '24.2%', label: 'Professionals stuck in a mid-career stall' },
  { value: '15–20%', label: 'Pay cut after an AI-driven layoff' },
  { value: '8%', label: 'Lower household wealth, 6 years after a layoff' },
]

const painPoints = [
  "Applications vanish into a void — you never find out how you're actually coming across.",
  'ATS filters you out before a human ever reads your name, regardless of how qualified you are.',
  'LinkedIn is a performance stage, not an honest marketplace — and "Open to Work" reads as a stigma.',
  'A gap on your resume can feel like something to hide, not something to explain.',
  "The loneliness is real — a search can feel like the only person who knows you're struggling is you.",
  "The financial pressure doesn't wait, even when the process does.",
]

const genericRejectionExamples = [
  '"Thank you for your interest in the [Role] position. After careful consideration, we have decided to move forward with other candidates who more closely match our needs at this time."',
  '"We appreciate you taking the time to apply and interview with us. Unfortunately, we will not be moving forward with your application at this time. We wish you the best in your search."',
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
              href="#why-stuck"
              className="hidden text-sm font-medium text-muted-foreground hover:text-foreground lg:inline-block"
            >
              Why you&apos;re stuck
            </Link>
            <Link
              href="#how-it-works"
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
          <div className="mt-4">
            <SampleReportPreview />
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
      <section id="why-stuck" className="scroll-mt-20 bg-navy text-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Why you&apos;re stuck</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-light-blue">
              You&apos;re not imagining it. This is genuinely hard — and most of it happens before a
              human ever sees your name.
            </p>
          </div>

          <ul className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
            {painPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4"
              >
                <X className="mt-0.5 size-4 shrink-0 text-orange" />
                <span className="text-sm leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-12 max-w-3xl">
            <h3 className="text-center text-xl font-semibold">
              The worst part isn&apos;t the rejection. It&apos;s never finding out why.
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-center text-light-blue">
              Most rejections read exactly like this — and give you nothing to actually learn from:
            </p>
            <div className="mt-6 space-y-4">
              {genericRejectionExamples.map((example) => (
                <blockquote
                  key={example}
                  className="rounded-xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-light-blue italic"
                >
                  {example}
                </blockquote>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-4xl border-t border-white/10 pt-12">
            <ByTheNumbers />
          </div>

          <div className="mx-auto mt-4 max-w-4xl">
            <SituationalButtons />
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* Section 4 — CTA footer */}
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
            <Link href="/for-coaches" className="underline underline-offset-4">
              Coaches
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
