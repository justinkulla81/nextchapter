import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadStrengths } from '@/lib/profile/strengths-load'
import { Spinner } from '@/components/ui/spinner'
import { StrengthsRedesign, WhyHireView } from '@/components/dashboard/StrengthsRedesign'
import { EmptyNote } from '@/components/candidate/Blocks'
import { StrengthsViewed } from '@/components/dashboard/StrengthsViewed'

export const metadata: Metadata = { title: 'Why hire me' }

// Where the person stands out, with the evidence, and the "why hire me" in
// their words. Weak spots show here (privately) as roles to go into with a
// plan; they never appear to employers.
export default async function StrengthsPage() {
  const profile = await getDashboardProfile()
  const st = await loadStrengths(profile.id)

  return (
    <>
      <StrengthsViewed shape={st.shape} peaks={st.peaks.map((p) => p.key)} />
      <StrengthsRedesign
        st={st}
        whyHire={
          st.shape === 'emerging' ? null : (
            <Suspense
              fallback={
                <p className="flex items-center gap-2 text-base text-muted-foreground">
                  <Spinner size={14} /> Writing your “why hire me”
                </p>
              }
            >
              <WhyHire candidateId={profile.id} />
            </Suspense>
          )
        }
      />
    </>
  )
}

// The AI write-up: reused while the inputs are unchanged, rewritten when they change.
async function WhyHire({ candidateId }: { candidateId: string }) {
  const st = await loadStrengths(candidateId, { writeUp: true })
  if (!st.whyHire) return <EmptyNote>We could not write this just now. Refresh in a minute.</EmptyNote>
  return <WhyHireView whyHire={st.whyHire} />
}
