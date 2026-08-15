import type { Metadata } from 'next'
import { HiringNav } from '@/components/hiring/HiringNav'
import { getCurrentHiringManager } from '@/lib/hiring/current-hiring-manager'
import { RoleContextBanner } from '@/components/auth/RoleContextBanner'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function HiringAppLayout({ children }: { children: React.ReactNode }) {
  const hiringManager = await getCurrentHiringManager()

  return (
    <div className="theme-partner min-h-screen">
      <HiringNav />
      {/* pt-14 clears the fixed top bar — see EmployerAppLayout/RecruiterAppLayout's identical comment. */}
      <div className="pt-14">
        <RoleContextBanner
          userId={hiringManager.userId!}
          currentRole="hiring_manager"
          personName={hiringManager.fullName}
          accountName={hiringManager.companyName}
          className="lg:pl-[calc(16rem+1.5rem)]"
        />
        <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
