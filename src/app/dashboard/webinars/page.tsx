import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getUpcomingWebinars, getCandidateWebinarRegistrations } from '@/lib/webinars/webinars'
import { registerForWebinarAction } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { buttonVariants } from '@/components/ui/button'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'

export const metadata: Metadata = { title: 'Webinars' }

export default async function WebinarsPage() {
  const profile = await getDashboardData()
  const [webinars, registeredIds] = await Promise.all([
    getUpcomingWebinars(),
    getCandidateWebinarRegistrations(profile.id),
  ])

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Webinars</h1>
        <p className="text-muted-foreground">
          Live sessions with coaches and the NextChapter team — register to get the join link and a
          reminder.
        </p>
        <PageHeaderBoxes pageKey="webinars" candidateId={profile.id} />
      </div>

      {webinars.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          Nothing scheduled right now — check back soon.
        </p>
      ) : (
        <div className="space-y-3">
          {webinars.map((w) => {
            const isRegistered = registeredIds.has(w.id)
            return (
              <div key={w.id} className="space-y-2 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-foreground">{w.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Hosted by {w.hostLabel} · {w.scheduledAt.toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      · {w.durationMinutes} min
                    </p>
                  </div>
                  {isRegistered ? (
                    <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                      Registered
                    </span>
                  ) : (
                    <form action={registerForWebinarAction.bind(null, w.id)}>
                      <SubmitButton size="sm" pendingLabel="Registering…">
                        Register
                      </SubmitButton>
                    </form>
                  )}
                </div>
                {w.description && <p className="text-sm text-muted-foreground">{w.description}</p>}
                {isRegistered &&
                  (w.meetLink ? (
                    <a
                      href={w.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ size: 'sm' })}
                    >
                      Join link
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Join link isn&apos;t ready yet — check back closer to the session.
                    </p>
                  ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
