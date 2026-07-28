import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getThreadWithMessages, markThreadRead } from '@/lib/messaging/threads'
import { MessageBubbles } from '@/components/messaging/MessageBubbles'
import { MessageComposer } from '@/components/messaging/MessageComposer'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { sendCoachMessage } from '../actions'

function candidateDisplayName(candidate: { firstName: string | null; lastName: string | null } | null): string {
  if (!candidate) return 'Candidate'
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
  return name || 'Candidate'
}

export default async function CoachThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/support/coach/login')

  const coach = await prisma.coach.findUnique({ where: { userId: user.id } })
  if (!coach) redirect('/support/coach/login')

  const thread = await getThreadWithMessages(threadId)
  if (!thread || thread.coachId !== coach.id) notFound()

  await markThreadRead(thread.id, 'partner')

  const candidateName = candidateDisplayName(thread.candidate)

  return (
    <div className="space-y-4">
      <div>
        <Link href="/support/coach/messages" className="text-sm text-muted-foreground underline underline-offset-4">
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
          selfRole="COACH"
          partnerName={candidateName}
          partnerAvatarUrl={thread.candidateAvatarUrl}
        />
      </div>

      <MessageComposer threadId={thread.id} action={sendCoachMessage} />
    </div>
  )
}
