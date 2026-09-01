import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatAdminDateTime } from '@/lib/admin/format-date'
import type { getStakeholderThreads } from '@/lib/admin/stakeholder-relationships'

function senderLabel(senderRole: string): string {
  if (senderRole === 'CANDIDATE') return 'Candidate'
  if (senderRole === 'ADMIN') return 'NextChapter Support'
  return 'Them'
}

// Shared across Coach/Recruiter/Employer sub-tabs — the only three
// relationship types with a real messaging channel (ThreadPartnerType).
// Admin can reply directly into a thread — sent as MessageSenderRole.ADMIN,
// never as the coach/recruiter/employer's own role, so it's never
// misattributed to them (see that enum value's own schema comment and
// MessageBubbles' rendering, which shows "NextChapter Support" rather than
// falling back to the partner's name/avatar for these).
export function StakeholderCommunicationsCard({
  threads,
  replyAction,
}: {
  threads: Awaited<ReturnType<typeof getStakeholderThreads>>
  replyAction: (threadId: string, formData: FormData) => Promise<void>
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
            <div key={thread.id} className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                {thread.coach?.fullName ?? thread.recruiter?.fullName ?? thread.employer?.companyName ?? 'Unknown'}
              </p>
              <ul className="space-y-1.5 text-sm">
                {thread.messages.map((message) => (
                  <li key={message.id}>
                    <span className="font-medium text-muted-foreground">{senderLabel(message.senderRole)}:</span>{' '}
                    <span className="text-foreground">{message.body}</span>{' '}
                    <span className="text-xs text-muted-foreground">{formatAdminDateTime(message.createdAt)}</span>
                  </li>
                ))}
              </ul>
              <form action={replyAction.bind(null, thread.id)} className="space-y-2 border-t border-border pt-3">
                <Textarea name="body" placeholder="Reply as NextChapter Support…" rows={2} required />
                <SubmitButton size="sm">Send</SubmitButton>
              </form>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
