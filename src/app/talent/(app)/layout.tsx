import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PortalActivityTracker } from '@/components/portal/PortalActivityTracker'
import { TalentNav } from '@/components/talent/TalentNav'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { getEmployerUnreadCount } from '@/lib/messaging/threads'
import { brandStyle, type PartnerBrand } from '@/lib/partners/brand'
import { talentBrand } from '@/lib/partners/resolve-brand'
import { createClient } from '@/lib/supabase/server'
import { employerSwitcherLinks, type SwitcherLink } from '@/lib/employer/switcher'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The unread count only feeds a nav badge, so it streams in its own Suspense
// boundary: the nav and {children} paint without waiting on it.
// getTalentDashboardData() has already run in the layout before this renders.
// Decoration only: any failure leaves the nav exactly as it was.
async function talentSwitcherLinks(): Promise<SwitcherLink[]> {
  try {
    const supabase = await createClient('talent')
    const { data: { user } } = await supabase.auth.getUser()
    return user ? await employerSwitcherLinks(user.id, user.email ?? null) : []
  } catch {
    return []
  }
}

async function TalentNavWithBadges({ employerId, brand }: { employerId: string; brand: PartnerBrand }) {
  const [messagesUnreadCount, sections] = await Promise.all([getEmployerUnreadCount(employerId), talentSwitcherLinks()])
  return <TalentNav messagesUnreadCount={messagesUnreadCount} brand={brand} sections={sections} />
}

export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const employer = await getTalentDashboardData()
  const brand = await talentBrand(employer)

  return (
    <div className="theme-partner min-h-screen" style={brandStyle(brand)}>
      <PortalActivityTracker portal="TALENT" />
      <Suspense fallback={<TalentNav brand={brand} />}>
        <TalentNavWithBadges employerId={employer.id} brand={brand} />
      </Suspense>
      {/* pt-14 clears the fixed top bar — see CoachAppLayout's comment. */}
      <div className="pt-14">
        <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
