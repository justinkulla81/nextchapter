import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCoachByToken } from '@/lib/coach/access'
import { getCoachCaseload } from '@/lib/coach/caseload'

export const maxDuration = 30

const SENTIMENT_TREND_ARROW: Record<'up' | 'down', string> = { up: '↑', down: '↓' }

export default async function CoachCaseloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const coach = await getCoachByToken(token)
  if (!coach) notFound()

  const caseload = await getCoachCaseload(coach.id)
  const stalled = caseload.filter((c) => c.isStalled)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <div>
        <Link href="/support/coach" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your caseload</h1>
        <p className="mt-1 text-muted-foreground">
          Market Reality, activity, and sentiment for each client, at a glance.
        </p>
      </div>

      {stalled.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            {stalled.length} client{stalled.length > 1 ? 's' : ''} showing an avoidance pattern —{' '}
            {stalled.map((c) => c.name).join(', ')}.
          </p>
        </div>
      )}

      <div className="divide-y divide-border rounded-lg border border-border">
        {caseload.length === 0 ? (
          <p className="flex min-h-[var(--row-height-partner)] items-center px-4 py-2 text-sm text-muted-foreground">
            No clients yet.
          </p>
        ) : (
          caseload.map((client) => (
            <Link
              key={client.id}
              href={`/support/coach/clients/${token}/${client.id}`}
              className="flex min-h-[var(--row-height-partner)] flex-col gap-2 px-4 py-3 hover:bg-muted"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-foreground">{client.name}</p>
                <p className="text-sm text-muted-foreground">
                  {client.weekNumber !== null ? `Week ${client.weekNumber}` : 'Not yet registered'}
                  {client.isStalled && ' · Avoidance pattern flagged'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Market Reality</p>
                  <p className="font-medium text-foreground">{client.marketRealityGrade ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Activity</p>
                  <p className="font-medium text-foreground">
                    {client.activityThisWeekPoints} pts this wk · {client.activityLastWeekPoints} pts last wk
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sentiment</p>
                  <p className="font-medium text-foreground">
                    {client.sentimentLabel ?? 'No check-ins'}
                    {client.sentimentTrend && ` ${SENTIMENT_TREND_ARROW[client.sentimentTrend]}`}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
