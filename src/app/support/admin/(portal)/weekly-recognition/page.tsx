import { requireAdmin } from '@/lib/admin/auth'
import { getWeeklyBadgeArchive } from '@/lib/badges/weekly-badge-archive'
import { AvatarDisplay } from '@/components/ui/avatar-display'

export default async function WeeklyRecognitionAdminPage() {
  await requireAdmin()
  const weeks = await getWeeklyBadgeArchive()

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly Recognition Archive</h1>
        <p className="mt-1 text-muted-foreground">
          Who made the A-List and earned badges, week by week — sourced from WeeklyBadgeEarned, the
          currently-written record.
        </p>
      </div>

      {weeks.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          No weekly badges recorded yet — this fills in as candidates use the app each week.
        </p>
      ) : (
        <div className="space-y-6">
          {weeks.map((week) => (
            <div key={week.weekStartDate.toISOString()} className="space-y-3 rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium text-muted-foreground">
                Week of {week.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </h2>
              <div className="divide-y divide-border">
                {week.candidates.map((c) => (
                  <div key={c.candidateId} className="flex items-center gap-3 py-2">
                    <AvatarDisplay name={c.name} url={c.avatarUrl} size={32} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.badgeLabels.join(', ')}</p>
                    </div>
                    {c.onAList && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                        A-List
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
