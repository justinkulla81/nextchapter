import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/constants/references'
import { cn } from '@/lib/utils'
import type { ReferenceStatus } from '@prisma/client'

export const maxDuration = 30

const STATUS_STYLES: Record<ReferenceStatus, string> = {
  REQUESTED: 'bg-muted text-muted-foreground',
  REMINDER_SENT: 'bg-muted text-muted-foreground',
  COMPLETED: 'bg-primary/10 text-primary',
  DECLINED: 'bg-destructive/10 text-destructive',
  EXPIRED: 'bg-destructive/10 text-destructive',
}

export default async function AdminReferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const reference = await prisma.reference.findUnique({
    where: { id },
    include: { candidate: { select: { id: true, displayName: true, firstName: true, lastName: true } } },
  })
  if (!reference) notFound()

  const candidateName =
    reference.candidate.displayName ||
    [reference.candidate.firstName, reference.candidate.lastName].filter(Boolean).join(' ') ||
    'Unnamed'

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link href="/support/admin/references" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to references
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {reference.refereeName}
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[reference.status])}>
            {reference.status === 'REMINDER_SENT' ? 'Requested' : reference.status.charAt(0) + reference.status.slice(1).toLowerCase()}
          </span>
        </h1>
        <p className="mt-1 text-muted-foreground">
          Reference for{' '}
          <Link href={`/support/admin/candidates/${reference.candidate.id}`} className="text-primary underline underline-offset-4">
            {candidateName}
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Who they are</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <p><span className="text-muted-foreground">Name:</span> {reference.refereeName}</p>
          <p><span className="text-muted-foreground">Email:</span> {reference.refereeEmail}</p>
          <p><span className="text-muted-foreground">Relationship:</span> {RELATIONSHIP_TYPE_LABELS[reference.relationshipType]}</p>
          {reference.refereeTitle && <p><span className="text-muted-foreground">Their title:</span> {reference.refereeTitle}</p>}
          {reference.refereeCompany && <p><span className="text-muted-foreground">Their company:</span> {reference.refereeCompany}</p>}
          {reference.yearsWorkedTogether != null && (
            <p><span className="text-muted-foreground">Years worked together:</span> {reference.yearsWorkedTogether}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <p><span className="text-muted-foreground">Requested:</span> {reference.requestedAt.toLocaleString()}</p>
          {reference.completedAt && <p><span className="text-muted-foreground">Completed:</span> {reference.completedAt.toLocaleString()}</p>}
          {reference.declinedAt && <p><span className="text-muted-foreground">Declined:</span> {reference.declinedAt.toLocaleString()}</p>}
          {reference.declineReason && (
            <p><span className="text-muted-foreground">Decline reason:</span> &quot;{reference.declineReason}&quot;</p>
          )}
        </CardContent>
      </Card>

      {reference.status === 'COMPLETED' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Written summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {reference.strengthSummary && (
              <p><span className="text-muted-foreground">Strengths:</span> {reference.strengthSummary}</p>
            )}
            {reference.growthAreaSummary && (
              <p><span className="text-muted-foreground">Growth area:</span> {reference.growthAreaSummary}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
