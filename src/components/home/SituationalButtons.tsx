'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { Shield, DoorOpen, Briefcase, RefreshCw, ArrowLeftRight, type LucideIcon } from 'lucide-react'
import { SITUATION_SESSION_KEY, type SituationKey } from '@/lib/constants/onboarding'

const SITUATIONS: { situation: SituationKey; icon: LucideIcon; label: string; description: string }[] = [
  {
    situation: 'worried_let_go',
    icon: Shield,
    label: "Worried I'll be let go",
    description: 'I want to prepare and be proactive.',
  },
  {
    situation: 'just_resigned',
    icon: DoorOpen,
    label: 'I just resigned',
    description: "I left on my terms — now what's next.",
  },
  {
    situation: 'just_laid_off',
    icon: Briefcase,
    label: 'I was just laid off',
    description: "I'm actively looking for my next role.",
  },
  {
    situation: 'reentering_workforce',
    icon: RefreshCw,
    label: 'Re-entering the workforce',
    description: "I'm returning after a break or gap.",
  },
  {
    situation: 'career_pivot',
    icon: ArrowLeftRight,
    label: 'Career pivot',
    description: 'I want to switch industries or roles.',
  },
]

export function SituationalButtons() {
  const posthog = usePostHog()

  return (
    <div className="mt-16">
      <h3 className="text-center text-xl font-semibold text-white">
        What&apos;s your situation right now?
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-light-blue">
        Choose the one that fits best — we&apos;ll skip straight to what matters for you.
      </p>
      <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {SITUATIONS.map(({ situation, icon: Icon, label, description }) => (
          <Link
            key={situation}
            href="/onboarding/resume"
            onClick={() => {
              posthog?.capture('situational_entry_selected', { situation, destination: 'onboarding' })
              window.gtag?.('event', 'situational_entry_selected', { situation, destination: 'onboarding' })
              sessionStorage.setItem(SITUATION_SESSION_KEY, situation)
            }}
            className="group flex flex-col items-start gap-2 rounded-xl border border-light-gray bg-white p-5 text-left transition-colors hover:border-brand hover:shadow-sm"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="size-5" />
            </span>
            <span className="font-semibold text-navy group-hover:text-brand">{label}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
