import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Card, CardContent } from '@/components/ui/card'
import { WaitlistForm } from '@/components/audience/WaitlistForm'
import type { AudienceTab } from '@/components/audience/audience-data'

export const metadata: Metadata = {
  title: 'The White-Label Coach Platform — NextChapter',
  description:
    'Put your brand on the client tools you already run sessions around — full client view, session notes and directives, your logo and colors.',
}

// Ad-hoc AudienceTab, deliberately not registered in AUDIENCE_TABS — this is
// a nested upsell page linked from /for-coaches, not a peer top-level
// audience, so it should never show up in the shared audience-tab switcher.
const TAB: AudienceTab = {
  id: 'coach-platform',
  audience: 'coach-platform',
  eyebrow: 'For Coaches — Premium',
  headline: 'Your brand, on the platform your clients already use every day.',
  subhead:
    'The free tools on /for-coaches are a companion to your practice. This is the other direction: your name, your logo, your colors, on the client-facing tools you build sessions around.',
  points: [
    {
      lead: 'Full client view, not a summary card.',
      body: 'Grade history, work history, references, mood trend, and your own session log — everything you'
        + ' need before or during a call, in one place.',
    },
    {
      lead: 'Real session notes and directives.',
      body: 'Log what you actually discussed. Directives you write show up for the client — private notes never do.',
    },
    {
      lead: 'Your name and logo, not ours.',
      body: 'Practice branding on the tools your clients see — a real alternative to sending them into an unbranded product.',
    },
  ],
  contrastLabel: 'What this is, and what it isn’t yet:',
  contrastBody:
    'Session scheduling (Calendar/Meet booking) and paid billing aren’t live yet — join the waitlist and we’ll follow up as those ship.',
  formHeading: 'Get early access',
  formSubtext: 'Tell us about your practice and we’ll reach out as the paid tier opens up.',
  fields: [
    { name: 'fullName', label: 'Full name', type: 'text', required: true },
    { name: 'workEmail', label: 'Work email', type: 'email', required: true },
    { name: 'practiceName', label: 'Practice name', type: 'text', required: false },
    { name: 'clientVolume', label: 'How many active clients do you coach?', type: 'text', required: false },
  ],
  successMessage: 'Thanks — we’ll follow up as the paid tier opens up.',
}

export default function CoachPlatformPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <Link
            href="/"
            className="order-2 shrink-0 text-sm text-muted-foreground hover:text-foreground sm:order-3"
          >
            For candidates
          </Link>
          <nav className="order-3 flex min-w-0 basis-full items-center gap-1.5 text-sm sm:order-2 sm:basis-auto">
            <Link href="/for-coaches" className="shrink-0 font-medium text-brand hover:text-navy">
              For Coaches
            </Link>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground sm:flex-none">
              {TAB.eyebrow}
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">{TAB.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{TAB.headline}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{TAB.subhead}</p>
          </div>

          <Card className="h-fit border-brand/20 bg-off-white">
            <CardContent className="pt-6">
              <WaitlistForm tab={TAB} />
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 grid items-start gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
            <Image
              src="/marketing/coach-full-client-view.png"
              width={1280}
              height={1394}
              alt="Full Client View for a coach's client, showing targeting, grade history, work history, references, recent moods, and a session log with notes and directives"
              className="w-full"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
            <Image
              src="/marketing/coach-client-list.png"
              width={1280}
              height={473}
              alt="A coach's client list showing execution grade, trend, and week number for each client in an expandable row"
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-12 max-w-2xl">
          <ul className="space-y-4">
            {TAB.points.map((point) => (
              <li key={point.lead} className="flex items-start gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-success" />
                <span className="text-base leading-relaxed text-foreground">
                  <span className="font-semibold">{point.lead}</span> {point.body}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-lg border border-light-gray bg-off-white p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{TAB.contrastLabel}</span> {TAB.contrastBody}
            </p>
          </div>
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/for-coaches" className="underline underline-offset-4">
            ← Free coach tools
          </Link>
          {' · '}
          <Link href="/" className="underline underline-offset-4">
            NextChapter for candidates
          </Link>
        </div>
      </main>
    </div>
  )
}
