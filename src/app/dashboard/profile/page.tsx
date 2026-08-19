import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getProfileChecklistItems, type ProfileChecklistActionType } from '@/lib/weekly/profile-checklist'
import { Button } from '@/components/ui/button'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'My Profile' }

interface SectionDef {
  href: string
  title: string
  description: string
  actionTypes: ProfileChecklistActionType[]
  // "Last completed" reads off these fields' own timestamps — a section
  // isn't "completed" until every one of these is set (see completedAt
  // below), so this list is deliberately the required subset of
  // actionTypes only (PROFILE_PICTURE_UPLOADED/LINKEDIN_PROFILE_ADDED are
  // bonus fields on Personal Info, not required to consider it done).
  timestamps: (candidateId: {
    profileConfirmedAt: Date | null
    industryConfirmedAt: Date | null
    functionConfirmedAt: Date | null
    salaryConfirmedAt: Date | null
    workAuthConfirmedAt: Date | null
    redFlagsBonusAt: Date | null
  }) => (Date | null)[]
  // My Personal Information is the one Weekly Sprint's Connecting/Working
  // and Learning categories actually gate on (see SuccessSprintCard's
  // PROFILE_UNLOCK_TYPES) — same "unlocks the most, so do this one first"
  // reasoning Skills & Behavioral Assessments' own Priority badge uses.
  priority?: boolean
}

// The two sub-pages this hub links to, and which profile-checklist items
// count toward each one's "X of Y points" summary below. Not every field
// on a sub-page carries points (e.g. Education and demographic self-ID are
// unscored) — this only reflects the scored items, same as everywhere else
// in the app. Compensation & benefits (BENEFITS_PRIORITIES_CONFIRMED) used
// to be a third "Search Goals" sub-page here — it now lives as a section on
// My Search Strategy instead (see search-strategy/page.tsx), since it's a
// search-goals question, not a profile-identity one.
const SECTIONS: SectionDef[] = [
  {
    href: '/dashboard/profile/personal',
    title: 'My Personal Information',
    description: 'Basics, education, industry, function & experience, salary, LinkedIn, and photo.',
    actionTypes: [
      'PROFILE_CONFIRM',
      'INDUSTRY_CONFIRM',
      'FUNCTION_CONFIRM',
      'SALARY_CONFIRM',
      'PROFILE_PICTURE_UPLOADED',
      'LINKEDIN_PROFILE_ADDED',
    ],
    timestamps: (p) => [p.profileConfirmedAt, p.industryConfirmedAt, p.functionConfirmedAt, p.salaryConfirmedAt],
    priority: true,
  },
  {
    href: '/dashboard/profile/screening',
    title: 'Screening Questions',
    description: 'Work authorization, drug test/background check willingness, deal-breakers, and demographics.',
    actionTypes: ['WORK_AUTHORIZATION', 'RED_FLAGS_CONFIRMED'],
    timestamps: (p) => [p.workAuthConfirmedAt, p.redFlagsBonusAt],
  },
]

// Landing/index page for the two sub-pages below — not a form itself.
// Each row's points/completion summary is its own consolidated total (see
// SuccessSprintCard.tsx's consolidateProfileDataRows for the matching
// per-page rows on the Success Dashboard). Row shape mirrors Skills &
// Behavioral Assessments' expandable-row list (see skills-assessments/
// page.tsx) rather than the plain link-cards this page used before, so the
// two "fill in a bunch of forms about yourself" hubs read as one consistent
// pattern instead of two different UI languages.
export default async function ProfileHubPage() {
  const profile = await getDashboardData()
  const items = await getProfileChecklistItems(profile.id)
  const pointsByType = new Map(items.map((i) => [i.actionType, i]))

  // Prompt 87 point 1 — the reassuring-tone pattern from Prompt 83 point 6
  // ("you're in good shape, one thing would make it stronger"), applied
  // here as an aggregate summary rather than per-section only. Computed
  // from the same per-section completion counts the rows below use, so
  // this can never disagree with them.
  const allItems = SECTIONS.flatMap((s) => s.actionTypes.map((t) => pointsByType.get(t)).filter((i) => i !== undefined))
  const totalItems = allItems.length
  const doneItems = allItems.filter((i) => i.complete).length
  const percentComplete = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0
  const firstIncompleteSection = SECTIONS.find((section) =>
    section.actionTypes.some((t) => !pointsByType.get(t)?.complete)
  )

  const sections = SECTIONS.map((section) => {
    const sectionItems = section.actionTypes.map((t) => pointsByType.get(t)).filter((i) => i !== undefined)
    const totalPoints = sectionItems.reduce((sum, i) => sum + i.points, 0)
    const earnedPoints = sectionItems.filter((i) => i.complete).reduce((sum, i) => sum + i.points, 0)
    const allDone = sectionItems.length > 0 && sectionItems.every((i) => i.complete)
    const timestamps = section.timestamps(profile).filter((d): d is Date => d !== null)
    const completedAt = allDone && timestamps.length > 0 ? new Date(Math.max(...timestamps.map((d) => d.getTime()))) : null

    return { ...section, totalPoints, earnedPoints, allDone, completedAt }
  })

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">
          Everything about you lives in one of the two sections below.
        </p>
        {totalItems > 0 && (
          <p className="text-sm text-foreground">
            {percentComplete === 100
              ? "You're fully set up — nice work."
              : `Your profile is ${percentComplete}% complete — you're in good shape. ${
                  firstIncompleteSection ? `One thing would make it stronger: ${firstIncompleteSection.title.toLowerCase()}.` : ''
                }`}
          </p>
        )}
        <PageHeaderBoxes pageKey="profile" candidateId={profile.id} />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Your Profile</h2>
        <div className="space-y-2">
          {sections.map((section) => {
            const statusLine = section.completedAt
              ? `Last completed ${section.completedAt.toLocaleDateString()}`
              : 'Not completed yet'

            return (
              <details key={section.href} className="group overflow-hidden rounded-lg border border-border">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{section.title}</p>
                      {section.priority && (
                        <span className="shrink-0 rounded-full bg-orange/15 px-2 py-0.5 text-xs font-medium text-orange">
                          Priority
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'truncate text-xs',
                        section.completedAt ? 'font-medium text-success' : 'text-muted-foreground'
                      )}
                    >
                      {statusLine}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {section.totalPoints > 0 && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                          section.allDone ? 'text-success' : 'bg-brand/10 text-brand'
                        )}
                      >
                        {section.allDone ? '✓ Complete' : `${section.earnedPoints} of ${section.totalPoints} pts`}
                      </span>
                    )}
                    <Button nativeButton={false} render={<Link href={section.href} />} size="sm">
                      Edit
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground underline underline-offset-4">
                      See details
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </div>
                </summary>
                <div className="space-y-3 border-t border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
              </details>
            )
          })}
        </div>
      </div>
    </div>
  )
}
