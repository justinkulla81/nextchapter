import type { WorkHistoryEntry } from '@prisma/client'
import { deleteWorkHistoryEntry, setPrimaryEngagement } from '@/app/dashboard/resume/actions'
import { SubmitButton } from '@/components/ui/submit-button'

const ENGAGEMENT_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Full-time',
  FRACTIONAL: 'Fractional',
  INTERIM: 'Interim',
  CONSULTING: 'Consulting',
}

function formatDateRange(startDate: Date, endDate: Date | null, isCurrent: boolean): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  return `${fmt(startDate)} – ${isCurrent || !endDate ? 'present' : fmt(endDate)}`
}

export function WorkHistoryList({ entries }: { entries: WorkHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No work history entries yet.</p>
  }

  const concurrentNonFullTime = entries.filter((e) => e.engagementType !== 'FULL_TIME' && e.isCurrent)
  const showPrimaryToggle = concurrentNonFullTime.length > 1

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {entry.roleTitle} · {entry.companyName}
                {entry.engagementType !== 'FULL_TIME' && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {ENGAGEMENT_TYPE_LABEL[entry.engagementType]}
                  </span>
                )}
                {entry.isPrimaryEngagement && (
                  <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                    Shown externally
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateRange(entry.startDate, entry.endDate, entry.isCurrent)}
              </p>
              {entry.keyAchievement && (
                <p className="mt-1 text-sm text-muted-foreground">{entry.keyAchievement}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {showPrimaryToggle && entry.engagementType !== 'FULL_TIME' && !entry.isPrimaryEngagement && (
                <form action={setPrimaryEngagement.bind(null, entry.id)}>
                  <SubmitButton variant="outline" size="sm">
                    Show this one
                  </SubmitButton>
                </form>
              )}
              <form action={deleteWorkHistoryEntry.bind(null, entry.id)}>
                <SubmitButton variant="ghost" size="sm">
                  Remove
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      ))}
      {showPrimaryToggle && (
        <p className="text-xs text-muted-foreground">
          You have more than one active fractional/interim role — only the one marked &quot;Shown
          externally&quot; appears on your Certified Executive Dossier and What They See.
        </p>
      )}
    </div>
  )
}
