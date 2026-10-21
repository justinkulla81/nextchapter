import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getProfileChecklistItems, type ProfileChecklistActionType } from '@/lib/weekly/profile-checklist'
import { prisma } from '@/lib/prisma'
import type { DimensionKey, Finding } from '@/lib/scoring/resume-analysis/types'
import { getMemberDisplayIdentity, buildMemberProfileSlug } from '@/lib/contacts/member-profile'
import { ProfileHubRedesign } from '@/components/dashboard/ProfileHubRedesign'

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
  const [items, latestAnalysis] = await Promise.all([
    getProfileChecklistItems(profile.id),
    prisma.resumeAnalysis.findFirst({
      where: { candidateId: profile.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, dimensionFindings: true },
    }),
  ])
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
  const hasResumeFindings = latestAnalysis
    ? Object.values(latestAnalysis.dimensionFindings as unknown as Record<DimensionKey, Finding[]>).flat().length > 0
    : false
  const hasUnaddressedResumeFeedback =
    hasResumeFindings && !!latestAnalysis && (!latestResume || latestResume.uploadedAt <= latestAnalysis.createdAt)

  // Profile in the redesign: how complete it is and why it matters, one next step, and the parts as plain rows.
  const resumeRow = profile.resumes[0]
  const resumeWhy = hasUnaddressedResumeFeedback
    ? 'You have résumé feedback you have not acted on yet. Updating it is the quickest way to improve your matches.'
    : 'Recruiters and hiring managers read this first, and your matches are built from it.'
  const publicProfileHref = `/dashboard/contacts/members/${buildMemberProfileSlug(getMemberDisplayIdentity(profile).displayName, profile.id)}`
  const next = firstIncompleteSection
    ? { href: firstIncompleteSection.href, label: `Finish ${firstIncompleteSection.title.replace(/^My /, '').toLowerCase()}`, key: firstIncompleteSection.href }
    : hasUnaddressedResumeFeedback
      ? { href: '/dashboard/resume', label: 'Update your résumé', key: '/dashboard/resume' }
      : null
  return (
    <ProfileHubRedesign
      parts={sections.map((sec) => ({ href: sec.href, title: sec.title.replace(/^My /, ''), description: sec.description, allDone: sec.allDone, completedAt: sec.completedAt }))}
      resume={resumeRow ? { uploadedAt: resumeRow.uploadedAt } : null}
      resumeWhy={resumeWhy}
      percentComplete={percentComplete}
      hasChecklist={totalItems > 0}
      firstIncompleteTitle={firstIncompleteSection ? firstIncompleteSection.title.replace(/^My /, '').toLowerCase() : null}
      next={next}
      publicProfileHref={publicProfileHref}
    />
  )
}
