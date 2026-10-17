import { notFound } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import { PlaceTabs } from '@/components/dashboard/PlaceTabs'

// Pages being redesigned are built here first, with sample data, inside the real
// navigation. Never reachable in production.
export default function DevPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="theme-candidate min-h-screen">
      <DashboardNav />
      <main className="min-h-screen bg-white px-6 pt-12 pb-24 lg:pb-12 lg:pl-[calc(18rem+1.5rem)]">
        <div className="mx-auto max-w-4xl space-y-8">
          <PlaceTabs employed={false} locks={{ hasEmailConnection: true, skillsAssessmentCompleted: true }} paidAccess={{ coaching: true, recruiters: true }} />
          {children}
        </div>
      </main>
    </div>
  )
}
