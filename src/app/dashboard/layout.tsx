import type { Metadata } from 'next'
import { DashboardNav } from '@/components/dashboard/DashboardNav'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The first-registration report generation + email (see get-dashboard-data.ts's
// `after()` block) runs an LLM call plus an email send in the background after
// the response is sent — comfortably past the platform's default function
// duration, which was silently truncating it before the email ever went out.
export const maxDuration = 60

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
