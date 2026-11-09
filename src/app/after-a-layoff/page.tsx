import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { AfterLayoffForm } from '@/components/marketing/AfterLayoffForm'
import { canonical } from '@/lib/seo/canonical'
import { FOUNDER_LINE } from '@/lib/marketing/founder-line'

// The page the owner sends to people who were just let go (LinkedIn, direct). One registration ask: the email form in the hero
// (docs: one registration ask per public page). The link's ?utm_source=<who> is saved on the lead (source "after-a-layoff:<who>";
// "after-a-layoff:li", LinkedIn, when the link has no tag). The four feature rows are the owner's value proposition: personalized job
// search, the AI coach, career exploration, fractional work. The images are the member screens with sample data. Kept out of the
// index: it is reached by link, not by search.
export const metadata: Metadata = {
  title: 'Laid off? Fired? Downsized? We can help you back faster | NextChapter',
  description: 'Your free job transition account: an AI coach that knows your whole search, jobs that fit you with the reason for each, other roles you could do, and fractional work.',
  ...canonical('/after-a-layoff'),
  robots: { index: false, follow: true },
}

interface Feature {
  id: string
  eyebrow: string
  title: string
  body: string
  points: string[]
  src: string
  alt: string
  caption: string
  width: number
  height: number
}

const FEATURES: Feature[] = [
  {
    id: 'jobs',
    eyebrow: 'Personalized job search',
    title: 'Jobs that fit you, with the reason for each.',
    body: 'Stop scrolling a board that treats you like everyone else. Every role tells you whether it fits and why.',
    points: [
      'A plain reason on every job: “You have led finance at a company this size.”',
      'Two quick answers sharpen the match, and you see how many more jobs they open up.',
      'Save a job, apply, or say “not for me” in one click.',
    ],
    src: '/marketing/after-layoff-jobs-fit.webp',
    alt: 'The NextChapter Find a job screen: a search bar, a “Better jobs for you” panel, a Chief Financial Officer role marked Good fit with the reason, and the Why this fits you panel',
    caption: 'Find a job: every role says why it fits you.',
    width: 1620,
    height: 1125,
  },
  {
    id: 'coach',
    eyebrow: 'AI coaching',
    title: 'A coach that knows your whole search, and changes the plan when it stalls.',
    body: 'Your coach, Victoria (disclosed as AI), works from your résumé, your applications, your networking and your learning. Four weeks and no interviews? You get different things to try, not the same reminder again.',
    points: [
      'Every note says why you are seeing it: “Four weeks and 12 applications without an interview usually means the search is too narrow.”',
      'You choose how you are coached: pushed hard, casual or supported.',
      'A weekly check-in adjusts your plan. Your answer is never shown to employers or recruiters.',
    ],
    src: '/marketing/after-layoff-coach-stalled.webp',
    alt: 'The NextChapter Home screen in week 4 of a search with 12 applications and no interviews, with the coach note “Widen your search by 150 jobs” and the reason',
    caption: 'Your week: the plan changes as your search does.',
    width: 1560,
    height: 1185,
  },
  {
    id: 'explore',
    eyebrow: 'Career exploration',
    title: 'See the other roles you could do, and what it takes to get there.',
    body: 'A firing can be the push to look at a different kind of job. See roles close to yours before you decide.',
    points: [
      'What carries over from your background, and what is missing.',
      'Pay and growth for each role, and the open jobs near you.',
      'Funded training in your state to close the gap.',
    ],
    src: '/marketing/after-layoff-explore-roles.webp',
    alt: 'The NextChapter Other roles you could do screen: Chief of Staff and Program Director, Healthcare, each with what carries over, what is missing, median pay, growth and funded programs',
    caption: 'Other roles you could do: what carries over and what is missing.',
    width: 1560,
    height: 1110,
  },
  {
    id: 'fractional',
    eyebrow: 'Fractional and independent work',
    title: 'Work while you search: fractional, interim and independent.',
    body: 'Not every next chapter is a full-time job. If you want to consult, take interim roles or run a fractional practice, your home screen is built for it.',
    points: [
      'See clients and engagements instead of job applications.',
      'Reminders for renewals and referrals, in time.',
      'Want a full-time role instead? It is one click.',
    ],
    src: '/marketing/after-layoff-fractional-home.webp',
    alt: 'The NextChapter Home screen for fractional and independent work: day rate, days a week open, next renewal, and a note to ask a client about renewing early',
    caption: 'Fractional and independent work: clients, renewals and your day rate.',
    width: 1560,
    height: 1185,
  },
]

// The hero screen has no orange button on purpose: the only orange button in the hero is the sign-up.
const HERO_SHOT = {
  src: '/marketing/after-layoff-coach-checkin.webp',
  alt: 'The NextChapter weekly check-in shown in three coaching tones, pushed hard, casual and supported, each with how your answer changes your plan',
  caption: 'The weekly check-in, in the coaching tone you choose.',
  width: 1635,
  height: 1080,
}

const STEPS = [
  { title: 'Know where you stand', body: 'Your Market Reality Assessment shows how hard this search will be and which parts are in your control.' },
  { title: 'Fix what is fixable', body: 'Your résumé is tested against the eleven systems that read it. Every issue comes with its fix.' },
  { title: 'Build what your résumé cannot say', body: 'Structured references and a skills and personality assessment, kept in one Executive Dossier you own.' },
]

const FAQ = [
  { q: 'Is it free?', a: 'Yes. NextChapter is free for Members, always.' },
  { q: 'Is it for me if I was fired, not laid off?', a: 'Yes. NextChapter is for anyone out of work, however it happened: laid off or let go, resigned, or taking a break.' },
  { q: 'Do I need a résumé?', a: 'No. You can start without a résumé and without an account.' },
  { q: 'Is the coach a person?', a: 'No. Your coach, Victoria, is AI, and we say so.' },
  { q: 'What do you do with my email?', a: 'We send the plan. You can unsubscribe from any email we send.' },
]

function Shot({ f, priority }: { f: Pick<Feature, 'src' | 'alt' | 'caption' | 'width' | 'height'>; priority?: boolean }) {
  return (
    <figure className="min-w-0">
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-lg">
        <Image src={f.src} alt={f.alt} width={f.width} height={f.height} sizes="(min-width: 1024px) 520px, 100vw" className="w-full" priority={priority} />
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">{f.caption} Sample data.</figcaption>
    </figure>
  )
}

export default function AfterALayoffPage() {
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-5">
          <Link href="/" aria-label="NextChapter home">
            <Logo className="text-2xl" />
          </Link>
        </div>
      </header>

      <main>
        <section aria-labelledby="fired-heading" className="mx-auto grid max-w-6xl items-center gap-10 px-6 pt-10 pb-14 lg:grid-cols-[1fr_1.05fr] lg:pt-14">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Laid off? Fired? Downsized?</p>
            <h1 id="fired-heading" className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
              15.58 million layoffs and discharges this year. We can help you back faster.
            </h1>
            <p className="mt-5 mb-7 max-w-xl text-lg text-muted-foreground">
              BLS counted them from January to September 2026, and you are one of them. NextChapter is a free AI coach that knows your whole search: jobs that fit you with the reason for each, a plan that changes when a search stalls, other roles you could do, and fractional work while you look.
            </p>
            <div className="rounded-3xl bg-navy p-5 text-white shadow-xl ring-1 ring-navy sm:p-6">
              <p className="text-xl font-semibold tracking-tight">Your free job transition account</p>
              <p className="mt-1 mb-4 text-sm text-white/85">Start with your email. We take you straight into setting it up, and send your first-week plan.</p>
              <AfterLayoffForm />
              <p className="mt-3 text-sm text-white/85">Free for Members, always. No résumé needed.</p>
            </div>
          </div>
          <Shot f={HERO_SHOT} priority />
        </section>

        <section aria-label="Why a résumé is not enough" className="bg-tint-sky">
          <div className="mx-auto max-w-6xl px-6 py-10 text-center">
            <p className="mx-auto max-w-3xl font-display text-2xl leading-snug font-semibold text-balance text-ink sm:text-3xl">
              A hiring manager scores you on 15 things. A résumé speaks to 2 of them.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
              NextChapter works from your applications, your networking and your learning, not just your résumé, and tailors every step to you.
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl space-y-16 px-6 py-16">
          {FEATURES.map((f, i) => (
            <section key={f.id} id={f.id} aria-labelledby={`${f.id}-title`} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14 [&>*]:min-w-0">
              <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                <p className="text-sm font-semibold tracking-widest text-brand uppercase">{f.eyebrow}</p>
                <h2 id={`${f.id}-title`} className="mt-2 font-display text-3xl leading-tight font-semibold text-balance text-ink">{f.title}</h2>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">{f.body}</p>
                <ul className="mt-4 space-y-2">
                  {f.points.map((pt) => (
                    <li key={pt} className="flex gap-3 text-base leading-relaxed text-ink">
                      <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={i % 2 === 1 ? 'lg:order-1' : ''}>
                <Shot f={f} />
              </div>
            </section>
          ))}
        </div>

        <section aria-label="How it works" className="bg-tint-sun">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="font-display text-3xl font-semibold text-ink">How it works</h2>
            <ol className="mt-6 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-base font-semibold text-brand">{i + 1}</span>
                  <div>
                    <p className="text-base font-semibold text-ink">{s.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-ink">
              Also free: the money side of a job loss, with tools for{' '}
              <Link href="/tools/layoff-deadlines" className="font-semibold text-brand underline underline-offset-4">unemployment and health-coverage deadlines</Link>
              {' '}and{' '}
              <Link href="/tools/severance-calculator" className="font-semibold text-brand underline underline-offset-4">severance</Link>.
            </p>
          </div>
        </section>

        <section aria-label="Questions" className="mx-auto w-full max-w-6xl px-6 py-14">
          <h2 className="font-display text-3xl font-semibold text-ink">Questions</h2>
          <dl className="mt-6 grid gap-x-12 gap-y-6 md:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-base font-semibold text-ink">{f.q}</dt>
                <dd className="mt-1 text-base leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 max-w-xl text-sm text-muted-foreground">{FOUNDER_LINE}</p>
        </section>
      </main>

      <footer className="mx-auto mt-auto w-full max-w-6xl px-6 pb-10 text-sm text-muted-foreground">
        <div className="border-t border-border pt-6">
          <Link href="/how-it-works" className="underline underline-offset-4">How it works</Link>
          {' · '}
          <Link href="/privacy-policy" className="underline underline-offset-4">Privacy policy</Link>
        </div>
      </footer>
    </div>
  )
}
