import type { Metadata } from 'next'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ByTheNumbers } from '@/components/home/ByTheNumbers'
import { SituationalButtons } from '@/components/home/SituationalButtons'

export const metadata: Metadata = {
  title: "Why You're Stuck — NextChapter",
  description:
    "You're not imagining it. Job searching is genuinely hard right now, and most of it happens before a human ever sees your name.",
  alternates: { canonical: '/why-stuck' },
}

const painPoints = [
  "Applications vanish into a void — you never find out how you're actually coming across.",
  'ATS filters you out before a human ever reads your name, regardless of how qualified you are.',
  'LinkedIn is a performance stage, not an honest marketplace — and "Open to Work" reads as a stigma.',
  'A gap on your resume can feel like something to hide, not something to explain.',
  "The loneliness is real — a search can feel like the only person who knows you're struggling is you.",
  "The financial pressure doesn't wait, even when the process does.",
]

const genericRejectionExamples = [
  '"Thank you for your interest in the [Role] position. After careful consideration, we have decided to move forward with other candidates who more closely match our needs at this time."',
  '"We appreciate you taking the time to apply and interview with us. Unfortunately, we will not be moving forward with your application at this time. We wish you the best in your search."',
]

export default function WhyStuckPage() {
  return (
    <div className="flex flex-1 flex-col bg-navy text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/">
            <Logo className="text-2xl text-white" />
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/how-it-works" className="text-light-blue hover:text-white">
              How it works
            </Link>
            <Link href="/" className="text-light-blue hover:text-white">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Why you&apos;re stuck</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-light-blue">
            You&apos;re not imagining it. This is genuinely hard — and most of it happens before a
            human ever sees your name.
          </p>
        </div>

        <ul className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
          {painPoints.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4"
            >
              <X className="mt-0.5 size-4 shrink-0 text-orange" />
              <span className="text-sm leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-12 max-w-3xl">
          <h2 className="text-center text-xl font-semibold">
            The worst part isn&apos;t the rejection. It&apos;s never finding out why.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-light-blue">
            Most rejections read exactly like this — and give you nothing to actually learn from:
          </p>
          <div className="mt-6 space-y-4">
            {genericRejectionExamples.map((example) => (
              <blockquote
                key={example}
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-light-blue italic"
              >
                {example}
              </blockquote>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-4xl border-t border-white/10 pt-12">
          <ByTheNumbers />
        </div>

        <div className="mx-auto mt-16 max-w-4xl border-t border-white/10 pt-12">
          <SituationalButtons />
        </div>
      </div>
    </div>
  )
}
