import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getAuthEmail, listAllAuthUsers } from '@/lib/admin/auth-users'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ConfirmForm } from '@/components/admin/ConfirmForm'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { approveEqOverIqApplication, rejectEqOverIqApplication } from '../../eqoveriq-applications/actions'

export const maxDuration = 30

const INTEREST_AREA_LABEL: Record<string, string> = {
  MODEL_EVALUATION: 'Model evaluation',
  RED_TEAMING: 'Red teaming',
  DATA_LABELING: 'Data labeling',
  PROMPT_ENGINEERING: 'Prompt engineering',
  RLHF: 'RLHF',
  FINE_TUNING: 'Fine-tuning',
  GENERALIST: 'Generalist',
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-warning/10 text-warning',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-destructive/10 text-destructive',
}

export default async function AdminEqOverIqContributorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const [contributor, authUsers] = await Promise.all([
    prisma.eqOverIqContributorProfile.findUnique({ where: { id } }),
    listAllAuthUsers(),
  ])
  if (!contributor) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/support/admin/eqoveriq-contributors" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to EQoverIQ contributors
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {contributor.fullName || 'Unnamed'}
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[contributor.status])}>
            {contributor.status.charAt(0) + contributor.status.slice(1).toLowerCase()}
          </span>
        </h1>
        <p className="mt-1 text-muted-foreground">{getAuthEmail(authUsers, contributor.userId)}</p>

        <div className="mt-3 flex items-center gap-2">
          <form action={approveEqOverIqApplication.bind(null, contributor.id)}>
            <SubmitButton size="sm" disabled={contributor.status === 'APPROVED'}>
              {contributor.status === 'APPROVED' ? 'Approved' : 'Approve'}
            </SubmitButton>
          </form>
          <ConfirmForm
            action={rejectEqOverIqApplication.bind(null, contributor.id)}
            confirmMessage="Reject this contributor's application?"
          >
            <SubmitButton size="sm" variant="outline" disabled={contributor.status === 'REJECTED'}>
              {contributor.status === 'REJECTED' ? 'Rejected' : 'Reject'}
            </SubmitButton>
          </ConfirmForm>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Background</p>
            <p className="text-foreground">{contributor.background || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">AI / fractional-work experience</p>
            <p className="text-foreground">{contributor.experienceSummary || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Interested in</p>
            <p className="text-foreground">
              {contributor.interestAreas.length > 0
                ? contributor.interestAreas.map((a) => INTEREST_AREA_LABEL[a] ?? a).join(', ')
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Why fractional AI work</p>
            <p className="text-foreground">{contributor.whyFractionalAiWork || '—'}</p>
          </div>
          {contributor.portfolioLinks.length > 0 && (
            <div>
              <p className="text-muted-foreground">Links</p>
              {contributor.portfolioLinks.map((link) => (
                <a
                  key={link}
                  href={link.startsWith('http') ? link : `https://${link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mr-2 block text-primary underline underline-offset-4"
                >
                  {link}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="text-foreground">{contributor.submittedAt ? contributor.submittedAt.toLocaleDateString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reviewed</dt>
              <dd className="text-foreground">{contributor.reviewedAt ? contributor.reviewedAt.toLocaleDateString() : '—'}</dd>
            </div>
            {contributor.reviewedBy && (
              <div>
                <dt className="text-muted-foreground">Reviewed by</dt>
                <dd className="text-foreground">{contributor.reviewedBy}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
