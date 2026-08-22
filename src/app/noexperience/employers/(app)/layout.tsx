import type { Metadata } from 'next'
import { getCrucibleEmployerDashboardData } from '@/lib/crucible/employers/get-employer-dashboard-data'
import { CrucibleEmployerNav } from '@/components/crucible/employers/CrucibleEmployerNav'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function CrucibleEmployerAppLayout({ children }: { children: React.ReactNode }) {
  await getCrucibleEmployerDashboardData()

  return (
    <div className="min-h-screen bg-off-white">
      <CrucibleEmployerNav />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
