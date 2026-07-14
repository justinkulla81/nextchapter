import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Check } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Card, CardContent } from '@/components/ui/card'
import { CoachingWaitlistForm } from '@/components/coaching/CoachingWaitlistForm'
import { StructuredData } from '@/components/StructuredData'

export const metadata: Metadata = {
  title: 'Executive Coach — A Real Human Coach, When You Want One | NextChapter',
  description:
    'NextChapter gives everyone Victoria, our free AI coach. Executive Coach adds a real human career coach on top, for candidates who want it — $500/month, waitlist open now.',
  alternates: { canonical: '/coaching' },
}

const INCLUDED = [
  'A dedicated human career coach, matched to your background and target role',
  'Regular 1:1 video sessions — not a chatbot, not a forum',
  'Live mock interviews with real-time feedback',
  'Direct review of your resume, LinkedIn, and outreach messages',
  'A second opinion on offers, negotiation, and hard calls Victoria can\'t make for you',
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter Executive Coach',
  serviceType: 'Career coaching',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'Audience', audienceType: 'Job seekers' },
  description:
    'A dedicated human career coach on top of Victoria, our free AI coach — mock interviews, resume review, and a second opinion on hard calls.',
  offers: {
    '@type': 'Offer',
    price: '500',
    priceCurrency: 'USD',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: '500',
      priceCurrency: 'USD',
      billingIncrement: 1,
      unitText: 'MONTH',
    },
  },
  url: 'https://launchyournextchapter.com/coaching',
}

export default function CoachingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link href="/dashboard" className="shrink-0 font-medium text-brand hover:text-navy">
              Dashboard
            </Link>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              Executive Coach
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">
              Executive Coach
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
              Victoria is free, always. Executive Coach adds a real human on top.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Victoria — our AI coach — is included for every candidate and isn&apos;t going
              anywhere. Executive Coach is a separate, paid option for people who want a real
              human career coach in their corner too: someone who&apos;s done real hiring, run
              real mock interviews, and can give you a second opinion Victoria isn&apos;t built to
              give.
            </p>

            <div className="mt-10 space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                What&apos;s included
              </h2>
              <ul className="space-y-2">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    <span className="text-base text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10 rounded-xl border border-border bg-off-white p-6">
              <p className="text-2xl font-bold text-navy">
                $500<span className="text-base font-medium text-muted-foreground">/month</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cancel anytime. Not currently open for new coaches — join the waitlist and
                we&apos;ll reach out as spots open up.
              </p>
            </div>
          </div>

          <Card className="h-fit border-brand/20 bg-off-white">
            <CardContent className="space-y-4 pt-6">
              <div>
                <h3 className="font-semibold text-foreground">Join the waitlist</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  We&apos;ll email you when a coach is available.
                </p>
              </div>
              <CoachingWaitlistForm source="coaching_page" />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
