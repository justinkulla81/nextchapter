import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getThreadWithMessages, markThreadRead } from '@/lib/messaging/threads'
import { MessageBubbles } from '@/components/messaging/MessageBubbles'
import { MessageComposer } from '@/components/messaging/MessageComposer'
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
  if (!user) redirect('/auth/login')

  const coach = await prisma.coach.findUnique({ where: { userId: user.id } })
  if (!coach) redirect('/auth/login')

  const thread = await getThreadWithMessages(threadId)
  if (!thread || thread.coachId !== coach.id) notFound()

  await markThreadRead(thread.id, 'partner')

  return (
    <div className="space-y-4">
      <div>
        <Link href="/support/coach/messages" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back to messages
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{candidateDisplayName(thread.candidate)}</h1>
      </div>

      <div className="rounded-lg border border-border">
        <MessageBubbles messages={thread.messages} selfRole="COACH" />
      </div>

      <MessageComposer threadId={thread.id} action={sendCoachMessage} />
    </div>
  )
}
