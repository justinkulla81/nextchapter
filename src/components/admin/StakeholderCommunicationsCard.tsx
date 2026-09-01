import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatAdminDateTime } from '@/lib/admin/format-date'
import type { getStakeholderThreads } from '@/lib/admin/stakeholder-relationships'

// Shared across Coach/Recruiter/Employer sub-tabs — the only three
// relationship types with a real messaging channel (ThreadPartnerType).
// Read-only: admins can see the conversation, not reply from here — a
// reply capability is a deliberate non-goal for this phase.
export function StakeholderCommunicationsCard({
  threads,
}: {
  threads: Awaited<ReturnType<typeof getStakeholderThreads>>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Communications ({threads.length} thread{threads.length === 1 ? '' : 's'})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages exchanged yet.</p>
        ) : (
          threads.map((thread) => (
            <div key={thread.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                {thread.coach?.fullName ?? thread.recruiter?.fullName ?? thread.employer?.companyName ?? 'Unknown'}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {thread.messages.map((message) => (
                  <li key={message.id}>
                    <span className="font-medium text-muted-foreground">
                      {message.senderRole === 'CANDIDATE' ? 'Candidate' : 'Them'}:
                    </span>{' '}
                    <span className="text-foreground">{message.body}</span>{' '}
                    <span className="text-xs text-muted-foreground">{formatAdminDateTime(message.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
