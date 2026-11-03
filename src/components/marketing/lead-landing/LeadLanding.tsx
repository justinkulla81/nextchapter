import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import type { LeadOffer } from '@/lib/marketing/lead-landing'
import { BOOKING_URL } from '@/lib/booking'
import { LeadForm } from './LeadForm'
import { LeadTracker } from './LeadTracker'
import { StickyCta } from './StickyCta'

// The page an ad click for a buyer lands on. Order, top to bottom: a header with the logo and nothing to leave by; the
// hero with the promise, three reasons and the form beside it; three problems the buyer recognizes; how it works; the
// product screens as proof; the objections as questions; the founder; the same form again. No navigation, no footer
// links except privacy. The public pages for the same audiences are the ones with navigation (see lead-landing.ts).

const TINTS = ['bg-tint-sun', 'bg-tint-mint', 'bg-tint-sky'] as const

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="mt-1 h-5 w-5 shrink-0 text-brand" fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
    </svg>
  )
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <h2 className="font-display text-3xl font-semibold text-ink text-balance">{title}</h2>
      {intro && <p className="mt-2 max-w-2xl text-base text-muted-foreground">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function LeadLanding({ offer }: { offer: LeadOffer }) {
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white pb-16 text-ink lg:pb-0">
      <LeadTracker offer={offer.key} />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="NextChapter home">
            <Logo className="text-2xl" />
          </Link>
          <a href={BOOKING_URL} target="_blank" rel="noopener" className="text-sm font-semibold text-brand underline underline-offset-4">
            Book a call
          </a>
        </div>
      </header>

      <main>
        <section aria-labelledby="lead-heading" className="mx-auto grid max-w-5xl gap-x-10 gap-y-8 px-6 pt-8 pb-14 lg:grid-cols-[1.15fr_1fr] lg:pt-14">
          <div className="lg:col-start-1 lg:row-start-1">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase sm:text-sm">{offer.audience}</p>
            <h1 id="lead-heading" className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
              {offer.headline}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{offer.subhead}</p>
          </div>
          <div id="lead-hero-form" className="scroll-mt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <LeadForm offer={offer} bookingUrl={BOOKING_URL} placement="hero" />
          </div>
          <div className="lg:col-start-1 lg:row-start-2">
            <ul className="space-y-3">
              {offer.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-base text-ink">
                  <Check />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 max-w-xl border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">{offer.founder}</p>
          </div>
        </section>

        <Section title="Sound familiar?">
          <ul className="grid gap-4 md:grid-cols-3">
            {offer.pains.map((p, i) => (
              <li key={p.title} className={`rounded-2xl p-5 ${TINTS[i % TINTS.length]}`}>
                <p className="text-base font-semibold text-ink">{p.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink">{p.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={offer.stepsTitle}>
          <ol className="grid gap-4 md:grid-cols-3">
            {offer.steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border p-5">
                <p className="text-sm font-semibold text-brand">Step {i + 1}</p>
                <p className="mt-1 text-base font-semibold text-ink">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title={offer.shotsTitle} intro={offer.shotsIntro}>
          <ul className="grid gap-6 md:grid-cols-3">
            {offer.shots.map((s) => (
              <li key={s.src}>
                <Image src={s.src} width={s.width} height={s.height} alt={s.alt} className="w-full rounded-xl border border-border" sizes="(min-width: 768px) 33vw, 100vw" />
                <p className="mt-3 text-sm font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.why}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Questions">
          <dl className="max-w-3xl space-y-5">
            {offer.faq.map((f) => (
              <div key={f.q}>
                <dt className="text-base font-semibold text-ink">{f.q}</dt>
                <dd className="mt-1 text-base leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <section aria-label="Start" className="mx-auto w-full max-w-xl px-6 pb-16">
          <LeadForm offer={offer} bookingUrl={BOOKING_URL} placement="footer" />
        </section>
      </main>

      <footer className="mx-auto mt-auto w-full max-w-5xl px-6 pb-10 text-sm text-muted-foreground">
        <div className="border-t border-border pt-6">
          <Link href="/privacy-policy" className="underline underline-offset-4">
            Privacy policy
          </Link>
        </div>
      </footer>

      <StickyCta label={offer.form.button} offer={offer.key} />
    </div>
  )
}
