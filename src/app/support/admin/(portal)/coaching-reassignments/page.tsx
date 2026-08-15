import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { RouteReassignmentForm } from '@/components/admin/RouteReassignmentForm'
import { SurgeOutreachForm } from '@/components/admin/SurgeOutreachForm'
import { getSurgeSignal } from '@/lib/coach/surge'

export const maxDuration = 30

const REQUESTED_BY_LABEL: Record<string, string> = {
  COACH: 'Coach requested',
  CANDIDATE: 'Candidate requested',
  ADMIN: 'Admin-initiated',
}

export default async function CoachingReassignmentsPage() {
  await requireAdmin()

  const [pending, recent, coaches, surgeSignal] = await Promise.all([
    prisma.coachReassignmentRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        fromCoach: { select: { id: true, fullName: true } },
      },
    }),
    prisma.coachReassignmentRequest.findMany({
      where: { status: { in: ['COMPLETED', 'DECLINED'] } },
      orderBy: { resolvedAt: 'desc' },
      take: 10,
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        fromCoach: { select: { fullName: true } },
        toCoach: { select: { fullName: true } },
      },
    }),
    prisma.coach.findMany({ where: { isSampleData: false }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
    getSurgeSignal(),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coaching operations</h1>
        <p className="mt-1 text-muted-foreground">
          Reassignment requests (§A5.4 — one-tap, no-blame, admin routes) and surge-capacity outreach.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Surge capacity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {surgeSignal.newSignupsLast24h} new signup{surgeSignal.newSignupsLast24h === 1 ? '' : 's'} in the last 24
            hours
            {surgeSignal.threshold !== null && (
              <>
                {' '}
                (threshold: {surgeSignal.threshold})
                {surgeSignal.overThreshold && <span className="ml-1 font-medium text-warning">— over threshold</span>}
              </>
            )}
            . {surgeSignal.benchCoachCount} coach{surgeSignal.benchCoachCount === 1 ? '' : 'es'} on the surge bench.
          </p>
          <SurgeOutreachForm benchCoachCount={surgeSignal.benchCoachCount} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending requests ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pending.</p>
          ) : (
            <ul className="space-y-4">
              {pending.map((r) => {
                const eligibleCoaches = coaches.filter((c) => c.id !== r.fromCoachId)
                return (
                  <li key={r.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">
                      {[r.candidate.firstName, r.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed candidate'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {REQUESTED_BY_LABEL[r.requestedBy]} · currently with {r.fromCoach?.fullName ?? 'no coach'} ·{' '}
                      {r.createdAt.toLocaleDateString()}
                    </p>
                    {r.reason && <p className="mt-1 text-sm text-foreground">&ldquo;{r.reason}&rdquo;</p>}
                    <div className="mt-2">
                      <RouteReassignmentForm requestId={r.id} eligibleCoaches={eligibleCoaches} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent history</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resolved requests yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {recent.map((r) => (
                <li key={r.id}>
                  {[r.candidate.firstName, r.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed'} —{' '}
                  {r.status === 'COMPLETED'
                    ? `moved from ${r.fromCoach?.fullName ?? 'no coach'} to ${r.toCoach?.fullName ?? '—'}`
                    : 'declined'}{' '}
                  ({r.resolvedAt?.toLocaleDateString()})
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
