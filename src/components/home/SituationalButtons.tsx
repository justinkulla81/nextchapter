'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { ArrowRight, Shield, DoorOpen, Briefcase, RefreshCw, type LucideIcon } from 'lucide-react'
import { SITUATION_SESSION_KEY, type SituationKey } from '@/lib/constants/onboarding'

// Career Pivot is deliberately not one of these — it's a cross-cutting
// question asked in Search Strategy (someone can be laid off AND pivoting),
// not its own situation. "Pivoter" survives only as a separate SEO landing
// page, not a product-level classification here.
const SITUATIONS: { situation: SituationKey; icon: LucideIcon; label: string; description: string }[] = [
  {
    situation: 'worried_let_go',
    icon: Shield,
    label: "I'm worried I'll be let go",
    description: 'Get ready and start building proof before you need it.',
  },
  {
    situation: 'just_resigned',
    icon: DoorOpen,
    label: 'I just resigned',
    description: 'Land on your feet — get your baseline grade now.',
  },
  {
    situation: 'just_laid_off',
    icon: Briefcase,
    label: 'I was just laid off',
    description: "Start your search with a plan, not a guessing game.",
  },
  {
    situation: 'reentering_workforce',
    icon: RefreshCw,
    label: "I'm re-entering the workforce",
    description: 'Prove your value after a break, starting today.',
  },
]

export function SituationalButtons() {
  const posthog = usePostHog()

  return (
    <div>
      <h3 className="text-center text-xl font-semibold text-navy">
        Which one sounds like you?
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
        Pick one and start now — we&apos;ll skip straight to what matters for your situation.
      </p>
      <div className="mx-auto mt-8 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SITUATIONS.map(({ situation, icon: Icon, label, description }) => (
          <Link
            key={situation}
            href="/onboarding/desire"
            onClick={() => {
              posthog?.capture('situational_entry_selected', { situation, destination: 'onboarding' })
              window.gtag?.('event', 'situational_entry_selected', { situation, destination: 'onboarding' })
              sessionStorage.setItem(SITUATION_SESSION_KEY, situation)
            }}
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-light-gray bg-white p-5 text-center transition-colors hover:border-brand hover:shadow-md"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-navy group-hover:text-brand">{label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand" />
          </Link>
        ))}
      </div>
    </div>
  )
}
