import type { Metadata } from 'next'
import { CoachNav } from '@/components/coach/CoachNav'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { getCoachUnreadCount } from '@/lib/messaging/threads'
import { getCoachCaseload } from '@/lib/coach/caseload'
import { RoleContextBanner } from '@/components/auth/RoleContextBanner'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function CoachAppLayout({ children }: { children: React.ReactNode }) {
  const coach = await getCurrentCoach()

  const [messagesUnreadCount, caseload] = await Promise.all([
    getCoachUnreadCount(coach.id),
    getCoachCaseload(coach.id),
  ])
  const stalledCount = caseload.filter((c) => c.isStalled).length

  return (
    <div className="min-h-screen">
      <CoachNav accessToken={coach.accessToken} messagesUnreadCount={messagesUnreadCount} actionCount={stalledCount} />
      {coach.userId && <RoleContextBanner userId={coach.userId} currentRole="coach" personName={coach.fullName} />}
      <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
