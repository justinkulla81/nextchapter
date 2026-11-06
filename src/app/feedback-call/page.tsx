import type { Metadata } from 'next'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { Squiggle } from '@/components/ui/squiggle'
import { ShortVersion } from '@/components/ui/short-version'
import { CONTACT_EMAIL } from '@/lib/contact/constants'

// An invitation page for outreach, not a page to find by search: kept out of the index and the sitemap.
export const metadata: Metadata = {
  title: { absolute: 'A 25-minute call about your work | NextChapter' },
  robots: { index: false, follow: false },
}

// Amounts the outreach tests (?a=75, ?a=100, ?a=150). Anything else falls back to the default,
// so a made-up link cannot put a different number on the page.
const AMOUNTS = [75, 100, 150] as const
const DEFAULT_AMOUNT = 100

/** Google Calendar appointment schedule for these calls (25 min). Unset until the schedule exists. */
const FEEDBACK_CALL_URL = process.env.FEEDBACK_CALL_URL || ''

export default async function FeedbackCallPage({ searchParams }: { searchParams: Promise<{ a?: string; s?: string }> }) {
  const { a, s } = await searchParams
  const asked = Number(a)
  const amount = AMOUNTS.find((x) => x === asked) ?? DEFAULT_AMOUNT
  const source = (s ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || null

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand">For workforce professionals</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-navy">Help us build for the people you serve</h1>
        <Squiggle className="mt-2" />
        <p className="mt-5 text-lg text-muted-foreground">
          NextChapter helps laid-off professionals get from a layoff notice to their next job. We want to hear how your team handles it today and where the tools fall short.
        </p>

        <ShortVersion className="mt-8">
          A 25-minute video call. You get a ${amount} gift card afterward, or we donate ${amount} to a charity you choose. We are asking for advice, not selling anything.
        </ShortVersion>

        <div className="mt-8">
          {FEEDBACK_CALL_URL ? (
            <TrackedLink
              href={FEEDBACK_CALL_URL}
              event="feedback_call_booking_opened"
              properties={{ amount, source, audience: 'workforce_development' }}
              className="inline-flex items-center justify-center rounded-lg bg-action px-6 py-3 text-base font-semibold text-action-foreground hover:brightness-95"
            >
              Pick a time
            </TrackedLink>
          ) : (
            <TrackedLink
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Feedback call')}`}
              event="feedback_call_email_clicked"
              properties={{ amount, source, audience: 'workforce_development' }}
              className="inline-flex items-center justify-center rounded-lg bg-action px-6 py-3 text-base font-semibold text-action-foreground hover:brightness-95"
            >
              Email us to set a time
            </TrackedLink>
          )}
        </div>

        <section aria-labelledby="what-we-ask" className="mt-12">
          <h2 id="what-we-ask" className="text-xl font-semibold text-navy">What we will ask about</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground">
            <li>The last large layoff in your area, and what happened in the first two weeks.</li>
            <li>What laid-off professionals ask for that is hard to give them today.</li>
            <li>The tools and processes you use now, and what you would change.</li>
          </ul>
        </section>
      </main>
      <PublicSiteFooter page="contact" cta={false} />
    </div>
  )
}
