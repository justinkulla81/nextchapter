import Link from 'next/link'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { getEmployerThreads } from '@/lib/messaging/threads'
import { AvatarDisplay } from '@/components/ui/avatar-display'

export default async function EmployerMessagesPage() {
  const employer = await getTalentDashboardData()
  const threads = await getEmployerThreads(employer.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-muted-foreground">
          Direct messages with candidates who&apos;ve been revealed to you.
        </p>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No conversations yet. Once a candidate approves your interest and is revealed, you can
            message them here.
          </p>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/talent/messages/${thread.id}`}
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
