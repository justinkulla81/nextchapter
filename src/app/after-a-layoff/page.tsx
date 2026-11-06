import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { AfterLayoffForm } from '@/components/marketing/AfterLayoffForm'
import { canonical } from '@/lib/seo/canonical'
import { FOUNDER_LINE } from '@/lib/marketing/founder-line'

// The page the owner sends to people who were just let go (LinkedIn, direct). One registration ask: the email form in the hero.
// The link's ?utm_source=<who> is saved on the lead (source "after-a-layoff:<who>"; "after-a-layoff:justin" when the link has no tag).
// Every claim below is already on the site, and the two images are screenshots of the live tools. Kept out of the index:
// it is reached by link, not by search.
export const metadata: Metadata = {
  title: 'Just got fired? Let us help | NextChapter',
  description: 'Get your first-week plan by email: the deadlines that cost people money, your state’s unemployment rules, and where your résumé stands. Free.',
  ...canonical('/after-a-layoff'),
  robots: { index: false, follow: true },
}

const TILES = [
  { title: 'Your dates, counted for you', body: 'Filing for unemployment and choosing health coverage have deadlines that start on your last day. Enter that day and see each date.', tint: 'bg-tint-sun' },
  { title: 'Your state’s rules, plain', body: 'How many weeks you can collect, the most it pays, whether there is a waiting week, and whether severance is deducted.', tint: 'bg-tint-mint' },
  { title: 'Where you stand in the market', body: 'Your Market Reality Assessment shows how the market reads your résumé, so your search starts from facts. Free for Members, always.', tint: 'bg-tint-sky' },
]

const STEPS = [
  { title: 'Leave your email', body: 'No account, no password and no résumé to start.' },
  { title: 'Read your first-week plan', body: 'It arrives in minutes: unemployment first, then who to tell, then your Market Reality Assessment.' },
  { title: 'Take the next step when you are ready', body: 'The button after you sign up opens your assessment. You can also stop at the email.' },
]

const FAQ = [
  { q: 'Is it free?', a: 'Yes. NextChapter is free for Members, always.' },
  { q: 'Do I need a résumé?', a: 'No. You can start without a résumé and without an account.' },
  { q: 'What do you do with my email?', a: 'We send the plan. You can unsubscribe from any email we send.' },
]

function Shot({ src, alt, caption, width, height }: { src: string; alt: string; caption: string; width: number; height: number }) {
  return (
    <figure>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-lg">
        <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 768px) 440px, 100vw" className="w-full" />
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}

export default function AfterALayoffPage() {
  return (
    <div className="theme-redesign flex flex-1 flex-col bg-white text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
          <Link href="/" aria-label="NextChapter home">
            <Logo className="text-2xl" />
          </Link>
        </div>
      </header>

      <main>
        <section aria-labelledby="fired-heading" className="mx-auto max-w-3xl px-6 pt-12 pb-12 text-center">
          <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Just got fired?</p>
          <h1 id="fired-heading" className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Do not spend week one guessing. Let us help.
          </h1>
          <p className="mx-auto mt-5 mb-8 max-w-2xl text-lg text-muted-foreground">
            Get a first-week plan by email. It starts with the deadlines that cost people money (filing for unemployment, severance and health coverage), then your job search.
          </p>
          <AfterLayoffForm />
          <p className="mt-3 text-sm text-muted-foreground">Free. No résumé. No account to start.</p>
        </section>

        <section aria-label="What you get" className="mx-auto w-full max-w-5xl px-6 pb-14">
          <h2 className="font-display text-2xl font-semibold text-ink">What you get</h2>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {TILES.map((t) => (
              <li key={t.title} className={`rounded-2xl p-5 ${t.tint}`}>
                <p className="text-base font-semibold text-ink">{t.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink">{t.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Inside NextChapter" className="mx-auto w-full max-w-5xl px-6 pb-14">
          <h2 className="font-display text-2xl font-semibold text-ink">Here is what it looks like</h2>
          <p className="mt-2 text-base text-muted-foreground">Screenshots of the live site: the deadlines tool with a last day entered, and a state page.</p>
          <div className="mt-6 grid items-start gap-8 md:grid-cols-2">
            <Shot
              src="/marketing/after-layoff-deadlines.png"
              alt="The NextChapter layoff deadlines tool after entering a last day of work: file for unemployment benefits, look at your health coverage options, and the dates by which each window closes"
              caption="Your dates, counted from your last day: unemployment, then health coverage."
              width={1296}
              height={1306}
            />
            <Shot
              src="/marketing/after-layoff-benefits.png"
              alt="The NextChapter California unemployment benefits page: up to 26 weeks, up to $450 a week, an unpaid waiting week, and severance not deducted"
              caption="Your state’s rules in plain numbers (California shown). Every state has its own page."
              width={1720}
              height={620}
            />
          </div>
          <p className="mt-6">
            <Link href="/unemployment-benefits" className="text-sm font-semibold text-brand underline underline-offset-4">See every state’s unemployment rules</Link>
          </p>
        </section>

        <section aria-label="How it works" className="mx-auto w-full max-w-5xl px-6 pb-14">
          <h2 className="font-display text-2xl font-semibold text-ink">What happens next</h2>
          <ol className="mt-5 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-base font-semibold text-brand">{i + 1}</span>
                <div>
                  <p className="text-base font-semibold text-ink">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Questions" className="mx-auto w-full max-w-5xl px-6 pb-14">
          <h2 className="font-display text-2xl font-semibold text-ink">Questions</h2>
          <dl className="mt-5 space-y-5">
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

      <footer className="mx-auto mt-auto w-full max-w-5xl px-6 pb-10 text-sm text-muted-foreground">
        <div className="border-t border-border pt-6">
          <Link href="/how-it-works" className="underline underline-offset-4">How it works</Link>
          {' · '}
          <Link href="/privacy-policy" className="underline underline-offset-4">Privacy policy</Link>
        </div>
      </footer>
    </div>
  )
}
