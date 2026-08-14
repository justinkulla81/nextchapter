import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ClipboardList, Compass, ListChecks, ShieldCheck, Trophy, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'How It Works — NextChapter',
  description:
    "From an honest baseline grade to a verified profile hiring managers trust: the five-step flow that gets you hired, on NextChapter's free job transition platform.",
  alternates: { canonical: '/how-it-works' },
}

interface Step {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    icon: Compass,
    eyebrow: 'Step 1',
    title: 'Hireability Assessment',
    description:
      "We analyze your resume, experience, and how your target market is actually hiring right now, and give you an honest Current Market Reality — exactly where you stand today, before you change anything.",
  },
  {
    icon: ClipboardList,
    eyebrow: 'Step 2',
    title: 'Search Strategy → your Search Sprint',
    description:
      'You tell us your target role, industries, and how you\'re approaching the search — then we turn that into a personalized weekly Search Sprint instead of showing you the same generic list everyone else gets.',
  },
  {
    icon: ListChecks,
    eyebrow: 'Step 3',
    title: 'Real actions, real points',
    description:
      'Every Search Sprint is built from specific, fixed-point Search Actions — not vague advice. A few examples:',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Step 4',
    title: 'Certified Executive Dossier',
    description:
      "Every reference, work sample, and network signal you build gets folded into your Dossier — a verified profile that shows a hiring manager what your resume can't, backed by people who've actually worked with you.",
  },
  {
    icon: Trophy,
    eyebrow: 'Step 5',
    title: 'Get the job',
    description:
      'You walk into every conversation with proof, not just a claim — an honest grade you improved yourself, and a Dossier a hiring manager can actually trust.',
  },
]

const EXAMPLE_ACTIONS = [
  { text: 'Send a personalized outreach message', points: 15 },
  { text: 'Update your resume with quantified achievements', points: 30 },
  { text: 'Complete a mock interview', points: 30 },
  { text: 'Publish a LinkedIn post', points: 20 },
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
            A clear path from &quot;I don&apos;t know where I stand&quot; to a job offer — five steps,
            each one building proof the last one didn&apos;t have. NextChapter is a free job
            transition platform, start to finish.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
          <Image
            src="/marketing/success-dashboard.png"
            alt="NextChapter Success Dashboard showing a Current Market Reality of B, an A Weekly Search Score, a streak, and completed Search Actions with their point values"
            width={1040}
            height={815}
            className="w-full"
          />
        </div>

        <div className="mx-auto mt-16 max-w-3xl space-y-10">
          {STEPS.map(({ icon: Icon, eyebrow, title, description }) => (
            <div key={title} className="flex gap-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold tracking-widest text-brand uppercase">{eyebrow}</p>
                <h2 className="mt-1 text-xl font-semibold text-navy">{title}</h2>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">{description}</p>
                {title.startsWith('Real actions') && (
                  <ul className="mt-3 space-y-1.5">
                    {EXAMPLE_ACTIONS.map((action) => (
                      <li key={action.text} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-foreground">{action.text}</span>
                        <span className="shrink-0 font-medium text-brand tabular-nums">{action.points} pts</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-2xl text-center">
          <h2 className="text-xl font-semibold text-navy">Hear it from Sarah</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            A NextChapter member on what the process actually looked like for her.
          </p>
          <div className="mx-auto mt-6 overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
            <video
              controls
              preload="metadata"
              className="w-full"
              src="https://uvoulytrsrxasqzutlmq.supabase.co/storage/v1/object/public/site-media/sarah-story.mp4"
            >
              Your browser doesn&apos;t support embedded video.
            </video>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Button nativeButton={false} size="lg" variant="cta" render={<Link href="/onboarding/desire" />}>
            Get your Hireability Assessment
          </Button>
        </div>
      </div>
    </div>
  )
}
