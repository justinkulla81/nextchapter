import type { ReactNode } from 'react'

/**
 * A titled section that starts closed. Native <details>, so it needs no
 * client JS and stays keyboard-accessible. `hint` sits beside the title and
 * stays visible while collapsed (counts, current value).
 */
export function Collapsible({
  title, hint, defaultOpen = false, children,
}: { title: string; hint?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer select-none flex-wrap items-baseline gap-x-3 gap-y-1 p-3 hover:bg-muted/50">
        <span className="text-base font-semibold">{title}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  )
}

/** Heading for a group of related sections on the profile. */
export function GroupHeading({ children }: { children: ReactNode }) {
  return <h2 className="border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
}
