import { Check } from 'lucide-react'
import { markRecommendationCompleted } from '@/app/dashboard/learning/actions'
import { SubmitButton } from '@/components/ui/submit-button'

export function RecommendedLearningCard({
  title,
  description,
  url,
  completed,
}: {
  title: string
  description: string
  url?: string
  completed: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-4">
      <div className="space-y-1">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            {title}
          </a>
        ) : (
          <p className="text-sm font-medium text-foreground">{title}</p>
        )}
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {completed ? (
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
          <Check className="size-3.5" /> Done
        </span>
      ) : (
        <form action={markRecommendationCompleted.bind(null, title, null)}>
          <SubmitButton variant="outline" size="sm" className="shrink-0">
            Mark done
          </SubmitButton>
        </form>
      )}
    </div>
  )
}
