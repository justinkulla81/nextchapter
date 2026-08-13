'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const STEPS = [
  { href: '/onboarding/resume', label: 'Resume' },
  { href: '/onboarding/desire', label: 'Your Path' },
  { href: '/onboarding/circumstances', label: 'Your Situation' },
]

export function OnboardingStepper({ completion }: { completion: boolean[] }) {
  const pathname = usePathname()

  // The shared onboarding layout renders this on every /onboarding/** page,
  // but these 3 steps are only the pre-account assessment — contract,
  // create-account, score, working-style, and the coach forms all happen
  // after that's already done. Showing "step 3 of 3" progress dots on a
  // page that isn't part of that sequence at all just reads as
  // stale/wrong, so render nothing outside the actual 3 step routes.
  if (!STEPS.some((step) => step.href === pathname)) return null

  return (
    <ol className="mx-auto flex w-full max-w-2xl items-center gap-2 px-6 py-6">
      {STEPS.map((step, i) => {
        const isActive = pathname === step.href
        const isDone = completion[i]
        return (
          <li key={step.href} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isDone
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                'hidden text-sm sm:inline',
                isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}
