import Link from 'next/link'
import { MessageSquareHeart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getFeedbackImpact, getFeedbackRequests } from '@/lib/companies/ex-employee-feedback'

// Two things for a member who has worked at companies on the board: a request for
// anonymous feedback where one is hiring now, and — once they have shared — what it
// did (how many members looked, how many applied).
export async function FeedbackRequests({ candidateId }: { candidateId: string }) {
  const [requests, impact] = await Promise.all([getFeedbackRequests(candidateId), getFeedbackImpact(candidateId)])
  if (requests.length === 0 && impact.length === 0) return null

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      {requests.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquareHeart className="size-4 text-brand" aria-hidden />
            You&apos;ve worked at companies that are hiring. What&apos;s it like there?
          </p>
          <p className="text-sm text-muted-foreground">
            Your answer is anonymous. It helps members deciding whether to apply.
          </p>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.companyId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-foreground">
                  {r.companyName} <span className="text-muted-foreground">· {r.openRoles} open {r.openRoles === 1 ? 'role' : 'roles'}</span>
                </span>
                <Button
                  nativeButton={false}
                  render={<Link href={`/dashboard/companies/${encodeURIComponent(r.slug)}`} />}
                  size="sm"
                  variant="outline"
                >
                  Share feedback
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {impact.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">What your feedback did</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {impact.map((i) => (
              <li key={i.slug}>
                <span className="text-foreground">{i.companyName}:</span>{' '}
                {i.viewed !== null ? `${i.viewed} members looked` : i.viewedAny ? 'fewer than 5 members looked' : 'no one has looked yet'}
                {' · '}
                {i.applied !== null ? `${i.applied} applied` : i.appliedAny ? 'fewer than 5 applied' : 'no one has applied yet'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
