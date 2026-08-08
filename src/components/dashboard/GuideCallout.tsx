import type { CurrentJobStatus } from '@prisma/client'
import { getGuidesForSlot, getRelevantGuides, type GuidePageSlot } from '@/lib/constants/guides'
import { GuideCard } from '@/components/dashboard/GuideCard'

// Drop this at the bottom of a dashboard page. Pass `pageSlot` to show only
// the guide(s) that belong to that page; omit it to show every guide
// relevant to the candidate's situation (used once, on the Learning page,
// as the "browse everything" surface that replaced the old /dashboard/guides
// hub). Renders nothing if there's nothing relevant to show.
export function GuideCallout({
  pageSlot,
  currentJobStatus,
  title = 'Related guides',
}: {
  pageSlot?: GuidePageSlot
  currentJobStatus: CurrentJobStatus | null
  title?: string
}) {
  const guides = pageSlot ? getGuidesForSlot(pageSlot, currentJobStatus) : getRelevantGuides(currentJobStatus)
  if (guides.length === 0) return null

  return (
    <div className="space-y-3 border-t border-border pt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <GuideCard key={guide.slug} guide={guide} />
        ))}
      </div>
    </div>
  )
}
