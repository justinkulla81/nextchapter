import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { getThreadWithMessages, markThreadRead } from '@/lib/messaging/threads'
import { MessageBubbles } from '@/components/messaging/MessageBubbles'
import { MessageComposer } from '@/components/messaging/MessageComposer'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { sendCandidateMessage } from '../actions'

export default async function CandidateThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getOrCreateCandidateProfile(user.id)
  const thread = await getThreadWithMessages(threadId)
  if (!thread || thread.candidateId !== profile.id) notFound()

  // Viewing the thread is the read signal, same as Community's
  // communityLastViewedAt pattern — no separate client-side effect needed.
  await markThreadRead(thread.id, 'candidate')

  const partnerName = thread.coach?.fullName ?? thread.recruiter?.fullName ?? thread.employer?.companyName ?? 'NextChapter contact'

  return (
    <div className="space-y-4">
      <div>
        <Link href="/dashboard/messages" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back to messages
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <AvatarDisplay name={partnerName} url={thread.partnerAvatarUrl} size={32} />
          <h1 className="text-2xl font-semibold tracking-tight">{partnerName}</h1>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <MessageBubbles
          messages={thread.messages}
          selfRole="CANDIDATE"
          partnerName={partnerName}
          partnerAvatarUrl={thread.partnerAvatarUrl}
        />
      </div>

      <MessageComposer threadId={thread.id} action={sendCandidateMessage} />
    </div>
  )
}
