import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { GraduationCap, Zap, Hammer, Users, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'How It Works — NextChapter',
  description:
    'Two grades you can actually move: an honest baseline, and a live score for the work you do every week — visible to hiring managers, recruiters, and coaches.',
  alternates: { canonical: '/how-it-works' },
}

const MARKET_FAILURES = [
  'A resume gets 6 seconds from a recruiter, then disappears into an ATS with no explanation.',
  "\"Culture fit\" and vague rejections hide the real reason — usually something you could actually fix.",
  'Effort between applications is invisible — networking, upskilling, and prep never reach the hiring manager.',
]

const EXECUTION_ACTIVITIES = [
  'Sending outreach messages to your network',
  'Applying to roles that actually fit',
  'Closing specific skill gaps',
  'Collecting references and work samples',
  'Prepping for interviews before they happen',
]

const FEATURES: { icon: LucideIcon; title: string; description: string; href: string }[] = [
  {
    icon: Users,
    title: 'Network',
    description:
      'Build a support network from your real contacts, get anxiety-calibrated outreach scripts, and track what you send — the connecting signal in your Search Execution Grade.',
    href: '/dashboard/network',
  },
  {
    icon: GraduationCap,
    title: 'Learn',
    description:
      "Recommendations pulled from your own Hireability Report gap analysis, plus the AI tools people in your function actually use — not a generic course catalog.",
    href: '/dashboard/learning',
  },
  {
    icon: Hammer,
    title: 'Work',
    description:
      'Upload real proof — work samples, resume, active LinkedIn content — that becomes part of the dossier a hiring manager sees alongside your background.',
    href: '/dashboard/work-samples',
  },
  {
    icon: Zap,
    title: 'Update',
    description:
      'A weekly Success Sprint turns your action plan into committed, trackable actions — the follow-through that moves your grade in real time.',
    href: '/dashboard/sprint',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/why-stuck" className="text-muted-foreground hover:text-foreground">
              Why you&apos;re stuck
            </Link>
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-navy sm:text-5xl">How it works</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            You can&apos;t fix what you can&apos;t see. We turn a confusing, silent process into two
            numbers you can actually move.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {MARKET_FAILURES.map((point) => (
            <p
              key={point}
              className="rounded-xl border border-light-gray bg-off-white px-5 py-4 text-sm leading-relaxed text-foreground"
            >
              {point}
            </p>
          ))}
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-light-gray bg-off-white p-6">
            <h2 className="font-semibold text-navy">Market Reality Grade — your baseline</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We analyze your resume, experience, and how your industry is actually hiring right now
              to give you an honest starting grade — exactly where you stand today, before you change
              anything.
            </p>
          </div>
          <div className="rounded-xl border border-light-gray bg-off-white p-6">
            <h2 className="font-semibold text-navy">Search Execution Grade — your progress</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This is the score you control. Every activity in your action plan raises it in real
              time — proof, in numbers, that you&apos;re doing the work.
            </p>
            <ul className="mt-3 space-y-1.5">
              {EXECUTION_ACTIVITIES.map((activity) => (
                <li key={activity} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
          <Image
            src="/marketing/success-dashboard.png"
            alt="NextChapter Success Dashboard showing a Market Reality B grade, an A weekly Search Score, a 12-day streak, and completed Search Action Tasks with their point values"
            width={1040}
            height={815}
            className="w-full"
          />
        </div>

        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold tracking-tight text-navy">
            The four things that move your Search Execution Grade
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-light-gray bg-white p-6">
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-3 font-semibold text-navy">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl rounded-xl border border-light-gray bg-navy px-8 py-8 text-center text-white">
          <p className="text-lg leading-relaxed">
            Every reference, work sample, and network signal you build here becomes part of an
            executive dossier — the Recruiter Report you hand to a hiring manager, a recruiter, or
            a coach alongside your resume and cover letter. Not just a resume claim, but proof
            you&apos;re actively, effectively working the process.
          </p>
        </div>

        <div className="mt-12 text-center">
          <Button size="lg" variant="cta" render={<Link href="/onboarding/resume" />}>
            Get started
          </Button>
        </div>
      </div>
    </div>
  )
}
