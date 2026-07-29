import { Check } from 'lucide-react'
import { OutboundPartnerLink } from '@/components/dashboard/OutboundPartnerLink'
import { SubmitButton } from '@/components/ui/submit-button'
import { markRecommendationCompleted } from '@/app/dashboard/learning/actions'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { LEARNING_PROVIDERS } from '@/lib/constants/learning-partners'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'

// One unified card for every Learning-page resource — Partner/Included-
// for-quality pill mirrors InterimListingGrid.tsx's exact classes, so the
// same trust signal reads consistently across the whole app.
export function LearningResourceCard({
  item,
  section,
  completed,
}: {
  item: LearningPlanItem
  section: string
  completed: boolean
}) {
  const provider = LEARNING_PROVIDERS[item.provider]
  const points = estimateActionEffort({ actionType: item.actionType }).points

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <OutboundPartnerLink
          href={item.url}
          partnerName={provider.name}
          section={section}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          {item.title}
        </OutboundPartnerLink>
        <span
          className={
            provider.designation === 'PARTNER'
              ? 'rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand'
              : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
          }
        >
          {provider.designation === 'PARTNER' ? 'Partner' : 'Included for quality'}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {item.free ? 'Free' : 'Paid'}
        </span>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">+{points} pts</span>
      </div>

      {item.rationale && <p className="text-xs italic text-foreground">{item.rationale}</p>}
      <p className="text-sm text-muted-foreground">{item.description}</p>
      {provider.designationNote && <p className="text-xs text-muted-foreground italic">{provider.designationNote}</p>}

      {completed ? (
        <span className="flex items-center gap-1 text-xs font-medium text-success">
          <Check className="size-3.5" /> Done
        </span>
      ) : (
        <form action={markRecommendationCompleted.bind(null, item.title, provider.name)}>
          <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
            Mark done
          </SubmitButton>
        </form>
      )}
    </div>
  )
}
