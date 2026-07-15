import type { LearningBadge } from '@prisma/client'
import { deleteLearningBadge } from '@/app/dashboard/learning/actions'
import { SubmitButton } from '@/components/ui/submit-button'

const BADGE_TYPE_LABEL: Record<string, string> = {
  course_completed: 'Course completed',
  certification: 'Certification',
  ai_project: 'AI project',
  conference_talk: 'Conference talk',
  published: 'Published',
}

export function LearningBadgeList({ badges }: { badges: LearningBadge[] }) {
  if (badges.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
  }

  return (
    <div className="space-y-2">
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-foreground">{badge.title}</p>
            <p className="text-xs text-muted-foreground">
              {BADGE_TYPE_LABEL[badge.badgeType] ?? badge.badgeType}
              {badge.provider ? ` · ${badge.provider}` : ''} ·{' '}
              {badge.completedAt.toLocaleDateString()}
            </p>
          </div>
          <form action={deleteLearningBadge.bind(null, badge.id)}>
            <SubmitButton variant="ghost" size="sm">
              Remove
            </SubmitButton>
          </form>
        </div>
      ))}
    </div>
  )
}
