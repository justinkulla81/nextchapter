import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getProfileChecklistItems, type ProfileChecklistActionType } from '@/lib/weekly/profile-checklist'
import { Button } from '@/components/ui/button'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { prisma } from '@/lib/prisma'
import type { DimensionKey, Finding } from '@/lib/scoring/resume-analysis/types'
import { cn } from '@/lib/utils'
import { getMemberDisplayIdentity, buildMemberProfileSlug } from '@/lib/contacts/member-profile'

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

  // "Fully set up" shouldn't just mean the two SECTIONS checklists are
  // done — a candidate who got real Resume Analysis feedback and never
  // acted on it (no re-upload since) isn't actually done, even if the
  // green bar above reads 100%. Real signal, not a guess: the latest
  // analysis's own findings, same JSON shape market-reality-report.ts
  // already reads for the same purpose.
  const latestResume = profile.resumes[0]
  const latestAnalysis = await prisma.resumeAnalysis.findFirst({
    where: { candidateId: profile.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, dimensionFindings: true },
  })
  const hasResumeFindings = latestAnalysis
    ? Object.values(latestAnalysis.dimensionFindings as unknown as Record<DimensionKey, Finding[]>).flat().length > 0
    : false
  const hasUnaddressedResumeFeedback =
    hasResumeFindings && !!latestAnalysis && (!latestResume || latestResume.uploadedAt <= latestAnalysis.createdAt)

  const fullySetUpMessage = percentComplete === 100 && (
    <div className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Daily Message</p>
      <p className="text-sm font-semibold text-navy">You&apos;re fully set up — nice work.</p>
      <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
        <li>Update anything that has changed since you last looked.</li>
        {hasUnaddressedResumeFeedback && (
          <li>
            <Link href="/dashboard/resume" className="font-medium text-primary underline underline-offset-4">
              Update your resume
            </Link>{' '}
            — you have Resume Analysis feedback you haven&apos;t acted on yet.
          </li>
        )}
      </ul>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">
          Everything about you lives in one of the sections below.
        </p>
        {totalItems > 0 && (
          <div className="space-y-1.5">
            {percentComplete < 100 && (
              <p className="text-sm text-foreground">
                {`Your profile is ${percentComplete}% complete — you're in good shape. ${
                  firstIncompleteSection ? `One thing would make it stronger: ${firstIncompleteSection.title.toLowerCase()}.` : ''
                }`}
              </p>
            )}
            <div
              role="progressbar"
              aria-valuenow={percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completion"
              className="h-1.5 w-full overflow-hidden rounded-full bg-off-white"
            >
              <div
                className={cn('h-full rounded-full transition-all', percentComplete === 100 ? 'bg-success' : 'bg-brand')}
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>
        )}
        <PageHeaderBoxes pageKey="profile" candidateId={profile.id} dailyMessageOverride={fullySetUpMessage || undefined} />
        <Link
          href={`/dashboard/contacts/members/${buildMemberProfileSlug(getMemberDisplayIdentity(profile).displayName, profile.id)}`}
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          View my public profile →
        </Link>
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

          {(() => {
            const latestResume = profile.resumes[0]
            const statusLine = latestResume
              ? `Last uploaded ${latestResume.uploadedAt.toLocaleDateString()}`
              : 'Not uploaded yet'
            return (
              <details className="group overflow-hidden rounded-lg border border-border">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">My Resume</p>
                    <p className={cn('truncate text-xs', latestResume ? 'font-medium text-success' : 'text-muted-foreground')}>
                      {statusLine}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Button nativeButton={false} render={<Link href="/dashboard/resume" />} size="sm">
                      Edit
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground underline underline-offset-4">
                      See details
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </div>
                </summary>
                <div className="space-y-3 border-t border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Upload, rename, and manage versions of your resume, get it analyzed, and run the Resume Fixer.
                  </p>
                </div>
              </details>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
