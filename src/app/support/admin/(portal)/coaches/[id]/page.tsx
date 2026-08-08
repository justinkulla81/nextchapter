import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { toggleCoachTestAccount } from './actions'

export const maxDuration = 30

export default async function AdminCoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const coach = await prisma.coach.findUnique({
    where: { id },
    include: {
      clients: {
        select: { id: true, firstName: true, lastName: true, coachDossierConsentedAt: true },
      },
      sessions: {
        orderBy: { occurredAt: 'desc' },
        take: 20,
        select: { id: true, occurredAt: true, candidateId: true },
      },
    },
  })
  if (!coach) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/support/admin/coaches" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to coaches
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {coach.fullName}
          {coach.isSampleData && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Test account
            </span>
          )}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {coach.firmName ?? 'No firm'} · {coach.workEmail} · {coach.focus}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {coach.userId ? 'Has a real login' : 'Token-only access (no login)'}
        </p>
        <form action={toggleCoachTestAccount.bind(null, coach.id, coach.isSampleData)} className="mt-3">
          <SubmitButton size="sm" variant="outline">
            {coach.isSampleData ? 'Unmark as test account' : 'Mark as test account'}
          </SubmitButton>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients ({coach.clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {coach.clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {coach.clients.map((c) => (
                <li key={c.id}>
                  <Link href={`/support/admin/candidates/${c.id}`} className="text-primary underline underline-offset-4">
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                  </Link>
                  {c.coachDossierConsentedAt ? ' — consented' : ' — no consent yet'}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions ({coach.sessions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {coach.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {coach.sessions.map((s) => (
                <li key={s.id}>{s.occurredAt.toLocaleDateString()}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
