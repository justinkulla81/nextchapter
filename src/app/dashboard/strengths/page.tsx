import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadStrengths } from '@/lib/profile/strengths-load'
import { loadBestFitSkills, loadWhyHireExtras } from '@/lib/profile/why-hire-load'
import { Spinner } from '@/components/ui/spinner'
import { BestFitSkills, WHY_HIRE_PARTS, WhyHireStatement, WhyHireView, type WhyHirePart } from '@/components/dashboard/why-hire/WhyHireView'
import { EmptyNote, SectionBlock } from '@/components/candidate/Blocks'
import { StrengthsViewed } from '@/components/dashboard/StrengthsViewed'

export const metadata: Metadata = { title: 'Why hire me' }

// Why an employer needs this person, the proof behind it, the gaps, and the pitch (WhyHireView). Weak spots show here
// privately as roles to go into with a plan; they never appear to employers.
export default async function StrengthsPage({ searchParams }: { searchParams: Promise<{ part?: string }> }) {
  const { part: raw } = await searchParams
  const part: WhyHirePart = WHY_HIRE_PARTS.includes(raw as WhyHirePart) ? (raw as WhyHirePart) : 'edge'
  const profile = await getDashboardProfile()
  const [st, extras] = await Promise.all([loadStrengths(profile.id), loadWhyHireExtras(profile.id, profile.primaryFunction ?? null)])

  return (
    <>
      <StrengthsViewed shape={st.shape} peaks={st.peaks.map((p) => p.key)} part={part} marks={extras.marks.filter((m) => m.done).length} />
      <WhyHireView
        part={part}
        st={st}
        extras={extras}
        statement={
          part !== 'edge' || st.shape === 'emerging' ? null : (
            <Suspense fallback={<Loading>Writing your “why hire me”</Loading>}>
              <Statement candidateId={profile.id} />
            </Suspense>
          )
        }
        skills={
          part !== 'gaps' ? null : (
            <Suspense
              fallback={
                <SectionBlock id="skills-h" title="What your best-fit jobs ask for">
                  <Loading>Reading the jobs that fit you</Loading>
                </SectionBlock>
              }
            >
              <Skills candidateId={profile.id} />
            </Suspense>
          )
        }
      />
    </>
  )
}

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-base text-muted-foreground">
      <Spinner size={14} /> {children}
    </p>
  )
}

// The AI write-up: reused while the inputs are unchanged, rewritten when they change.
async function Statement({ candidateId }: { candidateId: string }) {
  const st = await loadStrengths(candidateId, { writeUp: true })
  if (!st.whyHire) return <EmptyNote>We could not write this just now. Refresh in a minute.</EmptyNote>
  return <WhyHireStatement whyHire={st.whyHire} />
}

async function Skills({ candidateId }: { candidateId: string }) {
  const gap = await loadBestFitSkills(candidateId).catch(() => null)
  return <BestFitSkills gap={gap} />
}
