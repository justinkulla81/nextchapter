import type { Metadata } from 'next'
import { TalentNav } from '@/components/talent/TalentNav'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  await getTalentDashboardData()

  return (
    <div className="min-h-screen">
      <TalentNav />
      <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
