import type { ReactNode } from 'react'

// Shell every Learning-page section renders through — a title + optional
// description + whatever content the section needs. Sections that have no
// items to show just aren't rendered by the page at all (see
// build-learning-plan.ts), so there's no "empty state" branch to remember
// here.
export function LearningSection({
  id,
  title,
  description,
  children,
}: {
  // Optional DOM anchor id — lets other pages deep-link straight to this
  // section (e.g. /dashboard/learning#speaking-leadership from the
  // Marketing Plan redesign's low-comfort cross-link). scroll-mt-4 keeps
  // the heading from landing flush under the sticky header on scroll.
  id?: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div id={id} className={id ? 'scroll-mt-4 space-y-3' : 'space-y-3'}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}
