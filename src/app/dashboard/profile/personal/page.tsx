import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { createClient } from '@/lib/supabase/server'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { PersonalInformationView } from '@/components/dashboard/PersonalInformationView'

export const metadata: Metadata = { title: 'My Personal Information' }

// One of three sub-pages under the My Profile hub (see /dashboard/profile/page.tsx). Work authorization, screening questions and
// demographics live on the Screening Questions sub-page; comp and benefits on Search Goals; Personal Context on Search Strategy.
// The forms are grouped by purpose in PersonalInformationView (About you, Your background, Pay).
export default async function PersonalInformationPage() {
  const profile = await getDashboardProfile()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/dashboard/profile" className="text-sm text-muted-foreground hover:text-foreground">
          ← My Profile
        </Link>
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink">My personal information</h1>
        <PageHeaderBoxes pageKey="profile" candidateId={profile.id} />
      </div>
      <PersonalInformationView profile={profile} email={user?.email ?? ''} />
    </div>
  )
}
