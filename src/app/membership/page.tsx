import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { StructuredData } from '@/components/StructuredData'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export const metadata = {
  title: 'Alumni & Membership — NextChapter',
  description: 'Your Dossier stays alive after you land. Membership keeps your evidence current for the next time.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Alumni & Membership — NextChapter',
}

const BEATS = [
  { lead: 'Your Dossier stays alive.', body: 'Not archived, not frozen — an annual refresh keeps it current.' },
  { lead: 'A quarterly market check with comp benchmarking.', body: 'So you know where you stand even when you\'re not looking.' },
  { lead: 'Benefits from institutions our alumni bring in.', body: 'The Alumni Benefits Network — real programs, sourced by people who work there.' },
  { lead: 'Board and advisory listings.', body: 'Visibility into opportunities most searches never surface.' },
  { lead: 'Break-glass reactivation, in a day.', body: 'If it happens again, you\'re not starting from zero.' },
]

// Partners Master Build Script §C2.6/§C4.6 — membership "opens at placement,
// not before... the only moment it converts." Phase 8 already built the
// real signup/subscription flow at /dashboard/membership; this page is
// informational and links there rather than building a second, parallel
// form.
export default async function MembershipPage() {
  const [monthly, annual] = await Promise.all([
    getCurrentPlan('membership_monthly'),
    getCurrentPlan('membership_annual'),
  ])

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/" className="font-medium text-brand hover:text-navy">
              NextChapter
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">Alumni &amp; Membership</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">Alumni &amp; Membership</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Never start from zero again.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          You just did the hardest professional thing there is. Keep the evidence current so the next time
          takes weeks, not months.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button nativeButton={false} size="lg" variant="cta" render={<Link href="/dashboard/membership" />}>
            Join
          </Button>
        </div>
      </main>

      <div className="border-t border-border bg-off-white py-16">
        <div className="mx-auto max-w-3xl px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {BEATS.map((beat) => (
              <div key={beat.lead}>
                <p className="font-semibold text-navy">{beat.lead}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{beat.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h2 className="text-center text-xl font-bold tracking-tight text-navy">A real example from the catalog</h2>
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-light-gray bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Your target roles ask for FP&amp;A depth.
          </p>
          <p className="mt-1 text-base font-medium text-foreground">
            Kellogg exec-ed is offering members 40% off the Corporate Finance certificate through November —
            sourced by Priya R.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md text-center">
          <p className="font-semibold text-navy">Free for alumni, permanent.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Membership adds the market check, benefits network, and board listings for{' '}
            {monthly ? formatUsd(monthly.priceCents) : '—'}/mo
            {annual && <> or {formatUsd(annual.priceCents)}/yr</>}. Free for 12 months to anyone placed
            through a Premium outplacement seat.
          </p>
        </div>

        <div className="mt-16 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-4">
            Full pricing
          </Link>
          {' · '}
          <Link href="/dossier" className="underline underline-offset-4">
            About the Dossier
          </Link>
        </div>
      </main>
    </div>
  )
}
