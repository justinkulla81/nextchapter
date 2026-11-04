import type { ReactNode } from 'react'
import { CoachingWaitlistForm } from '@/components/coaching/CoachingWaitlistForm'

/**
 * The Premium waitlist offer (docs/candidate-redesign.md): one headline, the one action (the waitlist form) right under it, and the
 * three things the bundle includes as short lists, not three icon cards. Shared by the page and the dev-preview.
 */
export function PremiumOffer({
  coachLabel,
  recruiterLabel,
  coachIncluded,
  recruiterIncluded,
  marketIncluded,
  knownContact,
}: {
  coachLabel: string
  recruiterLabel: string
  coachIncluded: string[]
  recruiterIncluded: string[]
  marketIncluded: string[]
  knownContact?: { email: string; firstName: string | null; lastName: string | null }
}) {
  const col = (title: string, items: string[]): ReactNode => (
    <section key={title} aria-label={title} className="space-y-2">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <ul className="space-y-2 text-base text-ink">
        {items.map((item) => (
          <li key={item} className="flex gap-2"><span aria-hidden className="text-success">✓</span><span>{item}</span></li>
        ))}
      </ul>
    </section>
  )
  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">NextChapter Premium</p>
        <h1 className="max-w-3xl font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">
          A human coach, recruiter introductions and full market intelligence, together
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          It is not live yet. Join the waitlist and we reach out as spots open. Joining does not commit you to anything.
        </p>
      </header>
      <section aria-label="Join the Premium waitlist" className="max-w-xl rounded-2xl border border-border p-5">
        <CoachingWaitlistForm source="premium_bundle_dashboard" knownContact={knownContact} />
      </section>
      <div className="grid gap-8 md:grid-cols-3">
        {col(coachLabel, coachIncluded)}
        {col(recruiterLabel, recruiterIncluded)}
        {col('Market Intelligence', marketIncluded)}
      </div>
    </div>
  )
}
