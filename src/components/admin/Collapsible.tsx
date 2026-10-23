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

/**
 * What kind of content a group holds, shown as a colour so a page can be
 * scanned: things to act on are warm and sit at the top, the conversation is
 * blue, reference data is grey and sits lowest. Colour marks the section only;
 * the single accent colour stays reserved for primary actions.
 */
export type GroupTone = 'action' | 'history' | 'reference'

const TONE: Record<GroupTone, { dot: string; border: string }> = {
  action: { dot: 'bg-orange', border: 'border-orange/60' },
  history: { dot: 'bg-light-blue', border: 'border-light-blue/50' },
  reference: { dot: 'bg-gray', border: 'border-border' },
}

/** Heading for a group of related sections on the profile. */
export function GroupHeading({ children, tone = 'reference' }: { children: ReactNode; tone?: GroupTone }) {
  const t = TONE[tone]
  return (
    <h2 className={`flex items-center gap-2 border-b pb-1 text-xs font-semibold uppercase tracking-wide ${t.border} ${tone === 'reference' ? 'text-muted-foreground' : 'text-foreground'}`}>
      <span className={`h-2 w-2 rounded-full ${t.dot}`} aria-hidden />
      {children}
    </h2>
  )
}
