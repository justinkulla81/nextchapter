import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { getCandidateThreads } from '@/lib/messaging/threads'
import { AvatarDisplay } from '@/components/ui/avatar-display'

const PARTNER_TYPE_LABEL = {
  COACH: 'Coach',
  RECRUITER: 'Recruiter',
  EMPLOYER: 'Employer',
} as const

export default async function CandidateMessagesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getOrCreateCandidateProfile(user.id)
  const threads = await getCandidateThreads(profile.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-muted-foreground">
          Direct messages with your coach, recruiters, and employers you&apos;ve been revealed to.
        </p>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No conversations yet. Your coach, a recruiter, or an employer you&apos;ve approved will show up
            here once they reach out.
          </p>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/dashboard/messages/${thread.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-muted"
            >
              <div className="flex items-center gap-3">
                <AvatarDisplay name={thread.partnerName} url={thread.partnerAvatarUrl} size={36} />
                <div>
                  <p className="font-medium text-foreground">{thread.partnerName}</p>
                  <p className="text-sm text-muted-foreground">{PARTNER_TYPE_LABEL[thread.partnerType]}</p>
                </div>
              </div>
              {thread.unread && (
                <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange uppercase">
                  New
                </span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
