import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getRecruiterThreads } from '@/lib/messaging/threads'
import { AvatarDisplay } from '@/components/ui/avatar-display'

export default async function RecruiterMessagesPage() {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/recruiters/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  const threads = await getRecruiterThreads(recruiter.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-muted-foreground">Direct messages with candidates who signed up through you.</p>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No conversations yet. Start one from a candidate&apos;s page once they&apos;ve signed up.
          </p>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/recruiters/messages/${thread.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-muted"
            >
              <div className="flex items-center gap-3">
                <AvatarDisplay name={thread.candidateName} url={thread.candidateAvatarUrl} size={36} />
                <p className="font-medium text-foreground">{thread.candidateName}</p>
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
