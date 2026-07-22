import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export interface MySubmittedPosting {
  id: string
  title: string
  companyName: string
  status: string
  rejectionReason: string | null
  expiresAt: Date | null
  archivedAt: Date | null
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending review', className: 'bg-off-white text-muted-foreground' },
  approved: { label: 'Live', className: 'bg-brand/10 text-brand' },
  rejected: { label: 'Not approved', className: 'bg-destructive/10 text-destructive' },
}

export function MyJobBoardSubmissions({
  postings,
  reconfirmAction,
}: {
  postings: MySubmittedPosting[]
  reconfirmAction: (postingId: string) => Promise<void>
}) {
  if (postings.length === 0) {
    return <p className="text-sm text-muted-foreground">You haven&apos;t submitted any postings yet.</p>
  }

  return (
    <div className="space-y-3">
      {postings.map((posting) => {
        const isExpiringSoon =
          posting.status === 'approved' &&
          !posting.archivedAt &&
          posting.expiresAt &&
          posting.expiresAt.getTime() - new Date().getTime() < 5 * 24 * 60 * 60 * 1000
        const isExpired = posting.archivedAt !== null
        const statusInfo = isExpired
          ? { label: 'Expired', className: 'bg-off-white text-muted-foreground' }
          : STATUS_LABEL[posting.status]

        return (
          <div key={posting.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-foreground">
                {posting.title} <span className="text-muted-foreground">at {posting.companyName}</span>
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusInfo.className)}>
                  {statusInfo.label}
                </span>
                {posting.status === 'rejected' && posting.rejectionReason && (
                  <span className="text-xs text-muted-foreground">{posting.rejectionReason}</span>
                )}
                {isExpiringSoon && (
                  <span className="text-xs text-muted-foreground">
                    Expires {posting.expiresAt!.toLocaleDateString()} — reconfirm if still open
                  </span>
                )}
              </div>
            </div>
            {posting.status === 'approved' && !isExpired && (
              <form action={reconfirmAction.bind(null, posting.id)}>
                <SubmitButton variant="outline" size="sm" pendingLabel="Confirming…">
                  Still open — confirm
                </SubmitButton>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}
