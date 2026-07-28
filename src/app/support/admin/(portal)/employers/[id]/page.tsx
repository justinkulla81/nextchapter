import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

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
        ← Back to hiring managers
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{employer.companyName}</h1>
        <p className="mt-1 text-muted-foreground">
          {employer.contactName ?? 'No contact name'} · {getAuthEmail(authUsers, employer.userId)}
        </p>
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
