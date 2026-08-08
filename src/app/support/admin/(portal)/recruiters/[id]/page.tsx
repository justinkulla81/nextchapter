import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { toggleRecruiterTestAccount } from './actions'

export const maxDuration = 30

export default async function AdminRecruiterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const recruiter = await prisma.recruiter.findUnique({
    where: { id },
    include: {
      jobBoardSubmissions: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, companyName: true, status: true, disclosure: true },
      },
    },
  })
  if (!recruiter) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/support/admin/recruiters" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to recruiters
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {recruiter.fullName}
          {recruiter.isSampleData && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Test account
            </span>
          )}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {recruiter.firmName ?? 'No firm'} · {recruiter.workEmail}
          {recruiter.specialty && ` · ${recruiter.specialty}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {recruiter.userId ? 'Has a real login' : 'Token-only access (no login)'}
        </p>
        <form action={toggleRecruiterTestAccount.bind(null, recruiter.id, recruiter.isSampleData)} className="mt-3">
          <SubmitButton size="sm" variant="outline">
            {recruiter.isSampleData ? 'Unmark as test account' : 'Mark as test account'}
          </SubmitButton>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Board submissions ({recruiter.jobBoardSubmissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {recruiter.jobBoardSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {recruiter.jobBoardSubmissions.map((j) => (
                <li key={j.id}>
                  {j.title} — {j.disclosure === 'CONFIDENTIAL' ? 'confidential' : j.companyName} — {j.status}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
