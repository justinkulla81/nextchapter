'use client'

import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'
import { switchMainFocus } from '@/app/dashboard/other-paths/actions'
import { ActionSubmit } from './ActionSubmit'
import type { FocusOption, HomePathsRow } from '@/lib/journey/paths'

// Inside the journey card: the paths next to the main focus as one row, and "Focus right now" as adjacent buttons.
// Choosing one is the same server action as Your other paths (switchMainFocus), so previousMain behaves the same.
export function JourneyPaths({ row, options, main, href = '/dashboard/other-paths' }: { row: HomePathsRow; options: FocusOption[] | null; main: string; href?: string }) {
  const also = row.items.map((i) => `${i.label} (${i.level})`).join(', ')
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">
        <span className="font-semibold">Also:</span>{' '}
        <Link href={href} onClick={() => posthog.capture('home_paths_row_clicked', { paths: row.items.map((i) => i.key), main })} className="underline underline-offset-4">
          {also}
        </Link>
        {row.waiting && <span className="text-muted-foreground"> They wait while you have about {row.hours} hours a week, so your plan stays on your main focus.</span>}
      </p>
      {options && (
        <div role="group" aria-label="Focus right now" className="space-y-1.5">
          <p className="text-sm font-semibold text-ink">Focus right now</p>
          <div className="flex flex-wrap gap-2">
            {options.map((o) =>
              o.current ? (
                <span key={o.to} aria-current="true" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">
                  {o.label}
                </span>
              ) : (
                <form key={o.to} action={switchMainFocus}>
                  <input type="hidden" name="to" value={o.to} />
                  <ActionSubmit variant="secondary" pendingLabel="Switching…" event="home_focus_switched" props={{ from: main, to: o.to }}>
                    {o.label}
                  </ActionSubmit>
                </form>
              ),
            )}
          </div>
          <p className="text-xs text-muted-foreground">Your plan, menu and emails follow it. You can switch back any time.</p>
        </div>
      )}
    </div>
  )
}
