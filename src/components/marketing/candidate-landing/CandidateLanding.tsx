import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { LAYOFF_CLOCKS, LONG_SEARCH_FIGURE, type LandingContent } from '@/lib/marketing/candidate-landing'
import { FOUNDER_LINE } from '@/lib/marketing/founder-line'
import { LandingCta } from './LandingCta'
import { LandingTracker } from './LandingTracker'
import { StatePicker } from './StatePicker'

// The page for an ad click from a candidate. One headline, one button, nothing else to click: the header is the logo
// alone and the footer is two links. Below the hero: what the visitor gets, the state picker or the long-search figure,
// the questions, and the same button again. docs/candidate-redesign.md governs the app; this is a public page, so the
// first view is the hero and every section below says what it holds.

const TILE_TINTS = ['bg-tint-sun', 'bg-tint-mint', 'bg-tint-sky'] as const

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={title} className="mx-auto w-full max-w-4xl px-6 pb-14">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function CandidateLanding({ c }: { c: LandingContent }) {
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <LandingTracker page={c.page} variant={c.variant} />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
          <Link href="/" aria-label="NextChapter home">
            <Logo className="text-2xl" />
          </Link>
        </div>
      </header>

      <main>
        <section aria-labelledby="landing-heading" className="mx-auto max-w-3xl px-6 pt-14 pb-12 text-center">
          <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">{c.eyebrow}</p>
          <h1 id="landing-heading" className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            {c.headline}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{c.subhead}</p>
          <div className="mt-8">
            <LandingCta label={c.cta} persona={c.persona} page={c.page} variant={c.variant} placement="hero" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{c.ctaNote}</p>
        </section>

        <Section id="what-you-get" title="What you get">
          <ul className="grid gap-4 md:grid-cols-3">
            {c.tiles.map((t, i) => (
              <li key={t.title} className={`rounded-2xl p-5 ${TILE_TINTS[i % TILE_TINTS.length]}`}>
                <p className="text-base font-semibold text-ink">{t.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink">{t.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        {c.extras === 'clocks' ? (
          <>
            <Section id="your-state" title="Start with your state’s rules">
              <p className="mb-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
                The weekly amount, how many weeks, how to file and how severance counts, with sources and dates.
              </p>
              <StatePicker page={c.page} variant={c.variant} />
            </Section>
            <Section id="clocks" title="The clocks that start when you lose a job">
              <ol className="grid gap-4 md:grid-cols-2">
                {LAYOFF_CLOCKS.map((t) => (
                  <li key={t.title} className="rounded-2xl border border-border p-5">
                    <p className="text-base font-semibold text-ink">{t.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                  </li>
                ))}
              </ol>
            </Section>
          </>
        ) : (
          <Section id="not-imagining-it" title="You are not imagining it">
            <div className="rounded-2xl border border-border p-6">
              <p className="font-display text-5xl font-semibold text-ink">{LONG_SEARCH_FIGURE.value}</p>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink">{LONG_SEARCH_FIGURE.text}</p>
              <p className="mt-2 text-sm text-muted-foreground">Source: {LONG_SEARCH_FIGURE.source}</p>
              <p className="mt-4">
                <Link href="/why-stuck" className="text-sm font-semibold text-brand underline underline-offset-4">
                  Read why a search stalls
                </Link>
              </p>
            </div>
          </Section>
        )}

        <Section id="questions" title="Questions">
          <dl className="space-y-5">
            {c.faq.map((f) => (
              <div key={f.q}>
                <dt className="text-base font-semibold text-ink">{f.q}</dt>
                <dd className="mt-1 text-base leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <section aria-label="Start" className="mx-auto max-w-3xl px-6 pb-16 text-center">
          <LandingCta label={c.cta} persona={c.persona} page={c.page} variant={c.variant} placement="footer" />
          <p className="mt-3 text-sm text-muted-foreground">{c.ctaNote}</p>
          <p className="mx-auto mt-10 max-w-xl text-sm text-muted-foreground">{FOUNDER_LINE}</p>
        </section>
      </main>

      <footer className="mx-auto mt-auto w-full max-w-5xl px-6 pb-10 text-sm text-muted-foreground">
        <div className="border-t border-border pt-6">
          <Link href="/how-it-works" className="underline underline-offset-4">
            How it works
          </Link>
          {' · '}
          <Link href="/privacy-policy" className="underline underline-offset-4">
            Privacy policy
          </Link>
        </div>
      </footer>
    </div>
  )
}
