import type { Metadata } from 'next'
import Link from 'next/link'
import { CrucibleLandingTracker } from '@/components/crucible/CrucibleLandingTracker'
import { CrucibleWordmark } from '@/components/crucible/CrucibleWordmark'

export const metadata: Metadata = {
  // absolute, not a plain string — bypasses the root layout's "%s |
  // NextChapter" title template so the browser tab reads as its own brand.
  title: { absolute: 'noexperienceneeded.ai — Prove you\'re hireable' },
  description:
    'An AI wrote real code. It looks done. It isn\'t. You\'re not taking a test — the AI is. You\'re the judge. Free, 15 minutes, use any AI you want.',
}

const REJECTION_PHRASES = [
  'After careful consideration…',
  "We've decided to move forward with other candidates…",
  "We'll keep your resume on file…",
  'This role has been filled internally…',
  'You do not meet the minimum requirements…',
]

const RULES = [
  {
    title: 'Use AI. All of it.',
    body: 'Any model, any way. Tell us what you used — driving well earns points.',
  },
  {
    title: 'Resume optional. Score-proof.',
    body: 'It never touches your score. Attach it only if you want us to share it with real employers when you do well.',
  },
  {
    title: 'Real verdict, real stakes.',
    body: 'Do well → unlock the full assessment: a work sample employers actually read. Not yet → we\'ll show you exactly how to get there.',
  },
]

const VALUE_VECTORS = [
  'Sees problems everyone else walked past',
  'Asks the machine what nobody thought to ask',
  'Rebuilds a workflow instead of inheriting it',
  'Asks "why do we do it this way?" and means it',
  'Brings receipts instead of pedigree',
]

export default async function CruciblePage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>
}) {
  const { src } = await searchParams

  return (
    <div className="min-h-screen bg-[#0D0A14] font-[family-name:var(--font-archivo)] text-[#F5F3EE]">
      <CrucibleLandingTracker src={src ?? 'landing'} />
      {/* ── Header ── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <CrucibleWordmark dark className="text-lg" />
      </header>

      {/* ── Rejection ticker ── */}
      <div
        className="overflow-hidden border-y border-[#F5F3EE]/10 bg-[#0D0A14] py-3 [--ticker-duration:32s] motion-reduce:overflow-x-auto motion-reduce:[--ticker-duration:0s]"
        aria-hidden="true"
      >
        <div className="crucible-ticker-track flex w-max gap-12 whitespace-nowrap">
          {[...REJECTION_PHRASES, ...REJECTION_PHRASES].map((phrase, i) => (
            <span key={i} className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-[#F5F3EE]/40 line-through">
              {phrase}
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes crucible-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .crucible-ticker-track {
          animation: crucible-ticker-scroll var(--ticker-duration) linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .crucible-ticker-track { animation: none; }
        }
      `}</style>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest">
          <span className="text-[#C8FF1A]">NO EXPERIENCE NEEDED</span>
          <span className="text-[#2EE6FF]"> · FREE · 15 MIN · USE ANY AI</span>
        </p>
        <h1 className="mt-6 font-[family-name:var(--font-unbounded)] text-4xl leading-tight font-black tracking-tight text-[#F5F3EE] sm:text-6xl">
          Entry level. <span className="text-[#F5F3EE]/30 line-through">Five years&apos; experience required.</span>
          <br />
          Prove them wrong in 15 minutes.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[#F5F3EE]/70">
          An AI wrote real code. It looks done. It isn&apos;t.{' '}
          <span className="font-semibold text-[#F5F3EE]">You&apos;re not taking a test — the AI is. You&apos;re the judge.</span>{' '}
          Call ship or block. No resume, no experience, no gatekeeper.
        </p>
        <div className="mx-auto mt-8 max-w-xl rounded-lg border border-[#F5F3EE]/10 bg-black/30 p-4 text-left font-[family-name:var(--font-jetbrains-mono)] text-sm text-[#2EE6FF]">
          <span className="animate-pulse">▍</span> would you ship this?
        </div>
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href={`/crucible/test${src ? `?src=${encodeURIComponent(src)}` : ''}`}
            className="rounded-full bg-[#C8FF1A] px-8 py-4 text-base font-bold text-[#0D0A14] transition-transform hover:scale-105"
          >
            Prove you&apos;re hireable
          </Link>
          <a href="#after" className="text-sm text-[#F5F3EE]/50 underline underline-offset-4 hover:text-[#F5F3EE]">
            What happens after →
          </a>
        </div>
      </section>

      {/* ── Frustration block (magenta) ── */}
      <section className="border-t border-[#F5F3EE]/10 bg-[#1a0a1f] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-[#FF2E9A]">
            THE FRUSTRATION
          </p>
          <p className="mt-4 text-xl leading-relaxed text-[#F5F3EE]">
            You&apos;ve sent 300 applications into a void. A filter rejected you before a human existed in the
            loop. Your degree says English. The listing says no. Meanwhile the job itself changed: AI writes
            the code now. The scarce skill is directing it — and catching what it breaks. Nobody&apos;s degree
            covers that. Not even theirs.
          </p>
        </div>
      </section>

      {/* ── Belief block / the judge flip (lime) ── */}
      <section className="bg-[#0D0A14] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-[#C8FF1A]">
            THE JUDGE FLIP
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-unbounded)] text-2xl font-bold text-[#C8FF1A] sm:text-3xl">
            For once, you&apos;re the one doing the judging.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[#F5F3EE]/80">
            You&apos;ve been talking to these machines longer than most hiring managers have known they exist.
            That&apos;s not a fun fact — that&apos;s a skill. So we flipped the room: the AI did the work, and
            you decide if it&apos;s good enough to ship. No experience required. Judgment required.
          </p>
        </div>
      </section>

      {/* ── Value vectors (day-one asset framing) ── */}
      <section className="border-t border-[#F5F3EE]/10 bg-[#0D0A14] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-[#2EE6FF]">
            NO EXPERIENCE ≠ NO VALUE
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-unbounded)] text-2xl font-bold text-[#F5F3EE] sm:text-3xl">
            Here&apos;s what you&apos;d walk in with.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-[#F5F3EE]/10 bg-black/30 p-5">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-[#F5F3EE]/40">
                HOW IT&apos;S BEEN DONE
              </p>
              <p className="mt-3 font-[family-name:var(--font-jetbrains-mono)] text-sm text-[#F5F3EE]/60">
                Prompt: &quot;is this code good? looks fine to me&quot;
              </p>
              <p className="mt-2 text-sm text-[#F5F3EE]/60">The AI agrees. Nobody checks the write path.</p>
            </div>
            <div className="rounded-xl border border-[#C8FF1A]/30 bg-[#C8FF1A]/5 p-5">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-[#C8FF1A]">
                WHAT YOU&apos;D DO — DAY ONE
              </p>
              <p className="mt-3 font-[family-name:var(--font-jetbrains-mono)] text-sm text-[#F5F3EE]/80">
                Prompt: &quot;walk me through every write in this diff, one at a time&quot;
              </p>
              <p className="mt-2 text-sm text-[#F5F3EE]/80">The same AI finds its own bug in ten seconds.</p>
            </div>
          </div>
          <ul className="mt-8 space-y-2">
            {VALUE_VECTORS.map((v) => (
              <li key={v} className="flex items-start gap-2 text-[#F5F3EE]/80">
                <span className="mt-1 text-[#C8FF1A]">→</span>
                {v}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── The three rules (cyan cards) ── */}
      <section className="border-t border-[#F5F3EE]/10 bg-[#0a1a1f] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tracking-widest text-[#2EE6FF]">
            THE RULES
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {RULES.map((rule) => (
              <div key={rule.title} className="rounded-xl border border-[#2EE6FF]/20 bg-black/30 p-5">
                <p className="font-[family-name:var(--font-unbounded)] font-bold text-[#2EE6FF]">{rule.title}</p>
                <p className="mt-2 text-sm text-[#F5F3EE]/70">{rule.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What happens after ── */}
      <section id="after" className="scroll-mt-6 bg-[#0D0A14] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <details className="rounded-xl border border-[#F5F3EE]/10 bg-black/30 p-5">
            <summary className="cursor-pointer font-[family-name:var(--font-unbounded)] font-bold text-[#F5F3EE]">
              How scoring works
            </summary>
            <div className="mt-4 space-y-2 text-sm text-[#F5F3EE]/70">
              <p>Three short rounds: judge a real AI mistake, write a prompt that would fix a real page, and read a real dataset to make a real call.</p>
              <p>Each one has a real answer worth catching, and one cosmetic distraction that isn&apos;t worth blocking over.</p>
              <p>
                Chasing the distraction over the real issue costs points — calibration is part of judgment.
                Disclosing which AI you used, and how, earns points too.
              </p>
            </div>
          </details>
          <p className="mt-6 text-sm text-[#F5F3EE]/60">
            Score 75+ and we offer the full 75-minute version — a real work sample you can send to employers.
            Below that, we show you exactly what you missed and how to close the gap. Either way, you see both
            paths.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#F5F3EE]/10 px-6 py-8 text-center">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#F5F3EE]/40">
          Your data is yours — export or delete anytime.
        </p>
      </footer>
    </div>
  )
}
