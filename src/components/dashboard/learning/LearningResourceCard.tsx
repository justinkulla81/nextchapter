import { Check } from 'lucide-react'
import { OutboundPartnerLink } from '@/components/dashboard/OutboundPartnerLink'
import { SubmitButton } from '@/components/ui/submit-button'
import { markRecommendationCompleted } from '@/app/dashboard/learning/actions'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { LEARNING_PROVIDERS } from '@/lib/constants/learning-partners'
import type { LearningPlanItem } from '@/lib/learning/build-learning-plan'

// Platform-recognizable colors (not the individual school/company logos —
// see the sponsor label above for that) so a Coursera vs. edX course reads
// apart at a glance instead of every card looking identical. Generic
// brand-adjacent colors, not the platforms' actual logo assets.
const PLATFORM_BADGE_STYLE: Partial<Record<keyof typeof LEARNING_PROVIDERS, string>> = {
  coursera: 'bg-[#0056D2]/10 text-[#0056D2]',
  edx: 'bg-[#02262B]/10 text-[#02262B] dark:bg-white/10 dark:text-white',
}

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
  // Admin-managed courses (Course.provider) aren't limited to the known
  // platform slugs above — fall back to a plain, unbranded "included for
  // quality" pill using the admin's own text instead of crashing on an
  // unrecognized provider string.
  const provider = LEARNING_PROVIDERS[item.provider] ?? {
    name: item.provider,
    designation: 'INCLUDED_FOR_QUALITY' as const,
    designationNote: null,
  }
  const points = estimateActionEffort({ actionType: item.actionType }).points

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      {(item.logoUrl || item.sponsor) && (
        <div className="flex items-center gap-2">
          {item.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin-provided external URL, not a local asset
            <img src={item.logoUrl} alt="" className="size-6 shrink-0 rounded object-contain" />
          )}
          {item.sponsor && (
            <p className="text-xs font-semibold tracking-wide text-foreground uppercase">{item.sponsor}</p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <OutboundPartnerLink
          href={item.url}
          partnerName={provider.name}
          section={section}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          {item.title}
        </OutboundPartnerLink>
        {PLATFORM_BADGE_STYLE[item.provider] && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PLATFORM_BADGE_STYLE[item.provider]}`}>
            {provider.name}
          </span>
        )}
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
        {item.alreadyHeld && (
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            You already have this
          </span>
        )}
        <span className="text-xs font-medium tabular-nums text-muted-foreground">+{points} pts</span>
      </div>

      {item.rationale && <p className="text-xs italic text-foreground">{item.rationale}</p>}
      <p className="text-sm text-muted-foreground">{item.description}</p>
      {provider.designationNote && <p className="text-xs text-muted-foreground italic">{provider.designationNote}</p>}
      {item.completionCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {item.completionCount === 1
            ? '1 NextChapter candidate has completed this'
            : `${item.completionCount} NextChapter candidates have completed this`}
        </p>
      )}

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
