import type { Metadata } from 'next'
import { getEqOverIqContributorDashboardData } from '@/lib/eqoveriq/contributors/get-contributor-dashboard-data'
import { ContributorNav } from '@/components/eqoveriq/contributors/ContributorNav'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function EqOverIqContributorAppLayout({ children }: { children: React.ReactNode }) {
  await getEqOverIqContributorDashboardData()

  return (
    <div className="min-h-screen bg-off-white">
      <ContributorNav />
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  )
}
