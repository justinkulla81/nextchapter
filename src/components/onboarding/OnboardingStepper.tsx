'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const STEPS = [
  { href: '/onboarding/desire', label: 'Your Path' },
  { href: '/onboarding/resume', label: 'Resume' },
  { href: '/onboarding/confirm', label: 'Confirm' },
  { href: '/onboarding/location', label: 'Location' },
]

export function OnboardingStepper({ completion }: { completion: boolean[] }) {
  const pathname = usePathname()

  // The shared onboarding layout renders this on every /onboarding/** page,
  // but these 4 steps are only the pre-account assessment — comfort (now
  // folded into Location), contract, create-account, score, working-style,
  // and the coach forms all happen after that's already done. Showing
  // progress dots on a page that isn't part of that sequence at all just
  // reads as stale/wrong, so render nothing outside the actual 4 step routes.
  if (!STEPS.some((step) => step.href === pathname)) return null

  return (
    <ol className="mx-auto flex w-full max-w-2xl items-center gap-2 px-6 py-6">
      {STEPS.map((step, i) => {
        const isActive = pathname === step.href
        const isDone = completion[i]
        // A completed, non-active step is a real "go back and change my
        // answer" affordance only for Your Path and Resume — those two
        // pages no longer auto-redirect away once answered (see
        // onboarding/desire/page.tsx), so the link reliably lands on the
        // editable form, pre-filled with the current answer. Confirm and
        // Location both auto-redirect forward once their *ConfirmedAt field
        // is set (see e.g. onboarding/location/page.tsx),
        // so making those clickable would just bounce the candidate right
        // back to their current step — render them as plain checkmarks
        // instead. An incomplete future step stays non-interactive either
        // way; you can't skip ahead by clicking it.
        const supportsRevisit = i < 2
        const isClickable = isDone && !isActive && supportsRevisit
        const content = (
          <>
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
          </>
        )
        return (
          <li key={step.href} className="flex flex-1 items-center gap-2">
            {isClickable ? (
              <Link href={step.href} className="flex items-center gap-2 hover:opacity-80">
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-2">{content}</div>
            )}
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}
