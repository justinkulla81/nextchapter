import type { Metadata } from 'next'
import { RecruiterNav } from '@/components/recruiter/RecruiterNav'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { getRecruiterUnreadCount } from '@/lib/messaging/threads'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function RecruiterAppLayout({ children }: { children: React.ReactNode }) {
  const recruiter = await getCurrentRecruiter()

  const [messagesUnreadCount, addedNotYetInvited] = await Promise.all([
    getRecruiterUnreadCount(recruiter.id),
    prisma.sourcedCandidate.count({ where: { recruiterId: recruiter.id, status: 'ADDED' } }),
  ])

  return (
    <div className="min-h-screen">
      <RecruiterNav
        accessToken={recruiter.accessToken}
        messagesUnreadCount={messagesUnreadCount}
        actionCount={addedNotYetInvited}
      />
      <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
