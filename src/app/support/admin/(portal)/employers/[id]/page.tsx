import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { toggleEmployerTestAccount } from './actions'

export const maxDuration = 30

export default async function AdminEmployerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const [employer, authUsers] = await Promise.all([
    prisma.employerProfile.findUnique({
      where: { id },
      include: {
        roleProfiles: { orderBy: { createdAt: 'desc' }, select: { id: true, roleTitle: true, createdAt: true } },
        jobBoardSubmissions: { orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true } },
      },
    }),
    listAllAuthUsers(),
  ])
  if (!employer) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/support/admin/employers" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to employers
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {employer.companyName}
          {employer.isSampleData && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Test account
            </span>
          )}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {employer.contactName ?? 'No contact name'} · {getAuthEmail(authUsers, employer.userId)}
        </p>
        <form action={toggleEmployerTestAccount.bind(null, employer.id, employer.isSampleData)} className="mt-3">
          <SubmitButton size="sm" variant="outline">
            {employer.isSampleData ? 'Unmark as test account' : 'Mark as test account'}
          </SubmitButton>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Tier</dt>
              <dd className="text-foreground">{employer.subscriptionTier}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-foreground">{employer.subscriptionStatus}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">No-Ghosting Commitment</dt>
              <dd className="text-foreground">{employer.noGhostingCommitmentAccepted ? 'Accepted' : 'Not accepted'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles posted ({employer.roleProfiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {employer.roleProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {employer.roleProfiles.map((r) => (
                <li key={r.id}>
                  {r.roleTitle} — {r.createdAt.toLocaleDateString()}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job Board submissions ({employer.jobBoardSubmissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {employer.jobBoardSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {employer.jobBoardSubmissions.map((j) => (
                <li key={j.id}>
                  {j.title} — {j.status}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
