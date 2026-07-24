import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { getThreadWithMessages, markThreadRead } from '@/lib/messaging/threads'
import { MessageBubbles } from '@/components/messaging/MessageBubbles'
import { MessageComposer } from '@/components/messaging/MessageComposer'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { sendEmployerMessage } from '../actions'

function candidateDisplayName(candidate: { firstName: string | null; lastName: string | null } | null): string {
  if (!candidate) return 'Candidate'
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
  return name || 'Candidate'
}

export default async function EmployerThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params
  const employer = await getTalentDashboardData()

  const thread = await getThreadWithMessages(threadId)
  if (!thread || thread.employerId !== employer.id) notFound()

  await markThreadRead(thread.id, 'partner')

  const candidateName = candidateDisplayName(thread.candidate)

  return (
    <div className="space-y-4">
      <div>
        <Link href="/talent/messages" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back to messages
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <AvatarDisplay name={candidateName} url={thread.candidateAvatarUrl} size={32} />
          <h1 className="text-2xl font-semibold tracking-tight">{candidateName}</h1>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <MessageBubbles
          messages={thread.messages}
          selfRole="EMPLOYER"
          partnerName={candidateName}
          partnerAvatarUrl={thread.candidateAvatarUrl}
        />
      </div>

      <MessageComposer threadId={thread.id} action={sendEmployerMessage} />
    </div>
  )
}
