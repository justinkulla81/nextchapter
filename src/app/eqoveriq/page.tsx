import type { Metadata } from 'next'
import Link from 'next/link'
import { EqOverIqLandingTracker } from '@/components/eqoveriq/EqOverIqLandingTracker'
import { EqOverIqWordmark } from '@/components/eqoveriq/EqOverIqWordmark'

export const metadata: Metadata = {
  // absolute, not a plain string — bypasses the root layout's "%s |
  // NextChapter" title template so the browser tab reads as its own brand.
  title: { absolute: 'EQoverIQ — Fractional AI work for people who\'ve already proven it' },
  description:
    'A contributor pool for experienced professionals doing fractional AI work — model evaluation, red teaming, prompt engineering, and more. Apply once, reviewed by hand.',
}

const WORK_AREAS = [
  { title: 'Model evaluation', body: 'Judge real model output against a real bar — not a rubric written by someone who has never shipped one.' },
  { title: 'Red teaming', body: 'Find what a model does under adversarial pressure before a user does.' },
  { title: 'Prompt engineering', body: 'Turn a fuzzy intent into something a model can reliably act on.' },
  { title: 'RLHF & fine-tuning', body: 'Shape how a model actually behaves, not just how it answers one question.' },
  { title: 'Data labeling', body: 'The unglamorous work that decides whether everything downstream is worth trusting.' },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Apply', body: 'One application — your background, your relevant experience, and what kind of work you actually want.' },
  { step: '02', title: 'We review it by hand', body: 'No automated test, no rubric-matching bot. A real person reads what you sent.' },
  { step: '03', title: 'You’re in the pool', body: 'Approved contributors get matched to real work as it comes up — hands-on, on our end, for now.' },
]

export default function EqOverIqPage() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] font-[family-name:var(--font-manrope)] text-[#F5F3EF]">
      <EqOverIqLandingTracker />

      {/* ── Header ── */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <EqOverIqWordmark dark className="text-lg" />
        <Link
          href="/eqoveriq/contributors/login"
          className="text-sm text-[#F5F3EF]/60 underline underline-offset-4 hover:text-[#F5F3EF]"
        >
          Contributor log in
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center">
        <p className="font-[family-name:var(--font-plex-mono)] text-xs font-medium tracking-widest text-[#C9A227] uppercase">
          Fractional AI Work
        </p>
        <h1 className="mt-6 font-[family-name:var(--font-fraunces)] text-4xl leading-tight font-semibold tracking-tight text-[#F5F3EF] sm:text-5xl">
          For people who&apos;ve already proven it.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#F5F3EF]/70">
          A contributor pool for experienced professionals doing real, fractional AI work — model evaluation,
          red teaming, prompt engineering, and more. One application. Reviewed by a person, not a script.
        </p>
        <div className="mt-10">
          <Link
            href="/eqoveriq/contributors/signup"
            className="inline-block rounded-full bg-[#C9A227] px-8 py-3.5 text-base font-semibold text-[#0B0B0C] transition-opacity hover:opacity-90"
          >
            Apply as a contributor
          </Link>
        </div>
      </section>

      {/* ── What kind of work ── */}
      <section className="border-t border-[#F5F3EF]/10 bg-[#0F0F10] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="font-[family-name:var(--font-plex-mono)] text-xs font-medium tracking-widest text-[#C9A227] uppercase">
            What contributors do
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {WORK_AREAS.map((area) => (
              <div key={area.title} className="rounded-xl border border-[#F5F3EF]/10 bg-[#0B0B0C] p-5">
                <p className="font-[family-name:var(--font-fraunces)] font-semibold text-[#F5F3EF]">{area.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#F5F3EF]/60">{area.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works — honest about v1's manual matching ── */}
      <section className="bg-[#0B0B0C] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="font-[family-name:var(--font-plex-mono)] text-xs font-medium tracking-widest text-[#C9A227] uppercase">
            How it works
          </p>
          <div className="mt-8 space-y-8">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="flex gap-5">
                <span className="font-[family-name:var(--font-plex-mono)] text-sm text-[#F5F3EF]/30">{item.step}</span>
                <div>
                  <p className="font-[family-name:var(--font-fraunces)] font-semibold text-[#F5F3EF]">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#F5F3EF]/60">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm leading-relaxed text-[#F5F3EF]/50">
            We&apos;re early — there&apos;s no self-serve job board yet. Being in the pool means we reach out
            directly when something real is a fit for your background.
          </p>
        </div>
      </section>

      {/* ── Not a fit right now — the required Interim Work link ── */}
      <section className="border-t border-[#F5F3EF]/10 bg-[#0F0F10] px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-[family-name:var(--font-fraunces)] text-xl font-semibold text-[#F5F3EF]">
            Not a fit for fractional AI work right now?
          </p>
          <p className="mt-3 text-sm text-[#F5F3EF]/60">
            Looking for near-term income instead? NextChapter&apos;s Interim Work directory covers consultancy,
            marketplaces, expert networks, and board &amp; advisory roles.
          </p>
          <Link
            href="/dashboard/interim-work"
            className="mt-4 inline-block text-sm font-medium text-[#C9A227] underline underline-offset-4 hover:text-[#C9A227]/80"
          >
            See Interim Work →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#F5F3EF]/10 px-6 py-8 text-center">
        <p className="font-[family-name:var(--font-plex-mono)] text-xs text-[#F5F3EF]/40">
          A NextChapter product.
        </p>
      </footer>
    </div>
  )
}
