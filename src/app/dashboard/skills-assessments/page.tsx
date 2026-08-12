import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { SkillsToBuildForm } from '@/components/dashboard/SkillsToBuildForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getOrGenerateSkillGapSuggestions } from '@/lib/skills/skill-gap-suggestions'

export const metadata: Metadata = { title: 'Skills & Behavioral Assessments' }

// getOrGenerateSkillGapSuggestions calls the LLM on a cache miss (resume
// re-upload, changed target role/industries) — isolated here so that cost
// never blocks the two assessment cards above it, same pattern as
// SearchStrategyGuidanceCard on the Search Strategy page.
async function SkillsToBuildCard({ candidateId, skillsToBuild }: { candidateId: string; skillsToBuild: string[] }) {
  const suggestions = await getOrGenerateSkillGapSuggestions(candidateId)
  return <SkillsToBuildForm initialSkills={skillsToBuild} suggestions={suggestions} />
}

function SkillsToBuildSkeleton() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner size={16} />
      Putting together skill suggestions…
    </div>
  )
}

// Work Interests (spec module 5, O*NET RIASEC) isn't built yet — blocked on
// an O*NET Web Services account only the account owner can register.
// Track Record and What I Need (modules 4 and 6) are real now, listed in
// the main roster below.
const UPCOMING_MODULES = [
  {
    key: 'work-interests',
    title: 'Work Interests',
    description: 'What kind of work actually energizes you, based on the Holland RIASEC framework used across career counseling.',
    feeds: 'Feeds: Job Recommendations · Learning recommendations',
  },
] as const

export default async function SkillsAssessmentsPage() {
  const profile = await getDashboardData()

  const [latestWorkStyleResponse, latestPerformanceResponse, completedReferenceCount] = await Promise.all([
    prisma.candidateAssessmentResponse.findFirst({
      where: { candidateId: profile.id },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
    prisma.performanceAssessmentResponse.findFirst({
      where: { candidateId: profile.id },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
    prisma.reference.count({ where: { candidateId: profile.id, completedAt: { not: null } } }),
  ])

  const trackRecordCompletedAt = profile.trackRecordCompletedAt
  const whatINeedCompletedAt = profile.whatINeedCompletedAt

  const assessments = [
    {
      key: 'working-style',
      title: 'How I Work Best',
      description:
        'A quick self-report on your working style — how you operate, decide, and collaborate. Your references answer these same questions about you.',
      feeds: 'Feeds: Executive Dossier · Hiring Manager Notes · Coaching Notes',
      completedAt: latestWorkStyleResponse?.completedAt ?? null,
      points: estimateActionEffort({ actionType: 'WORKING_STYLE_QUIZ' }).points,
      href: '/dashboard/retake-assessment',
      ctaLabel: latestWorkStyleResponse ? 'Retake' : 'Take the quiz',
    },
    {
      key: 'performance',
      title: 'How I Perform',
      description:
        'How you execute, decide, hold up under pressure, and get things done through other people. Your references answer these same questions about you.',
      feeds: 'Feeds: Hireability Report category grades · Hiring Manager Notes',
      completedAt: latestPerformanceResponse?.completedAt ?? null,
      points: estimateActionEffort({ actionType: 'PERFORMANCE_ASSESSMENT_COMPLETED' }).points,
      href: '/dashboard/how-i-perform',
      ctaLabel: latestPerformanceResponse ? 'Retake' : 'Take the assessment',
    },
    {
      key: 'skills',
      title: 'Skills Inventory',
      description:
        'A candid self-read on your core function, AI fluency, and a few other skills that drive how jobs and courses get matched to you.',
      feeds: 'Feeds: Job Recommendations · Skills Recommendations · Hireability Report',
      completedAt: profile.skillsAssessmentCompletedAt,
      points: estimateActionEffort({ actionType: 'SKILLS_ASSESSMENT_COMPLETED' }).points,
      href: '/dashboard/skills-assessment',
      ctaLabel: profile.skillsAssessmentCompletedAt ? 'Retake' : 'Take the assessment',
    },
    {
      key: 'track-record',
      title: 'Track Record',
      description:
        'Scope, ownership, and the kind of situations you’ve operated in — verified against what your references say.',
      feeds: 'Feeds: Executive Dossier · Hiring Manager Notes',
      completedAt: trackRecordCompletedAt,
      points: estimateActionEffort({ actionType: 'TRACK_RECORD_COMPLETED' }).points,
      href: '/dashboard/track-record',
      ctaLabel: trackRecordCompletedAt ? 'Retake' : 'Take the assessment',
    },
    {
      key: 'what-i-need',
      title: 'What I Need',
      description:
        'The work values you’re not willing to trade away, ranked — comp, flexibility, growth, stability, and more.',
      feeds: 'Feeds: Search Strategy · Coaching Notes',
      completedAt: whatINeedCompletedAt,
      points: estimateActionEffort({ actionType: 'WHAT_I_NEED_COMPLETED' }).points,
      href: '/dashboard/what-i-need',
      ctaLabel: whatINeedCompletedAt ? 'Retake' : 'Take the assessment',
    },
    {
      key: 'reference-check',
      title: 'Reference Check',
      description:
        'The people who worked with you rate the same things you rated yourself on — the comparison is what a hiring manager actually wants to see.',
      feeds: 'Feeds: Hiring Manager Notes · self-vs-reference friction · Executive Dossier',
      completedAt: completedReferenceCount > 0 ? new Date(0) : null,
      statusLabel:
        completedReferenceCount > 0
          ? `${completedReferenceCount} reference${completedReferenceCount === 1 ? '' : 's'} completed`
          : 'Not completed yet',
      points: estimateActionEffort({ actionType: 'REFERENCE_ADDED' }).points,
      href: '/dashboard/references',
      ctaLabel: completedReferenceCount > 0 ? 'Manage references' : 'Request references',
    },
    // Not-completed first — that's the one thing actually asking for
    // attention on this page.
  ].sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt))

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Skills & Behavioral Assessments</h1>
        <p className="text-muted-foreground">
          These personalize your Job Recommendations, Skills Recommendations, and Hireability
          Report — the more current they are, the better the matches.
        </p>
        <PageHeaderBoxes pageKey="skills-assessments" candidateId={profile.id} />
      </div>

      <div className="space-y-2">
        {assessments.map((assessment) => {
          const statusLine =
            'statusLabel' in assessment
              ? assessment.statusLabel
              : assessment.completedAt
                ? `Last completed ${assessment.completedAt.toLocaleDateString()}`
                : 'Not completed yet'

          return (
            <details key={assessment.key} className="group overflow-hidden rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{assessment.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{statusLine}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {!assessment.completedAt && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand tabular-nums">
                      +{assessment.points} pts
                    </span>
                  )}
                  <span className="text-xs font-medium text-muted-foreground underline underline-offset-4">
                    See details
                  </span>
                </div>
              </summary>
              <div className="space-y-3 border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">{assessment.description}</p>
                <p className="text-xs font-medium text-muted-foreground">{assessment.feeds}</p>
                <Button nativeButton={false} render={<Link href={assessment.href} />} size="sm">
                  {assessment.ctaLabel}
                </Button>
              </div>
            </details>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground">Skills You Need to Build</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Skills worth building for your next job — pick from the suggestions below or add your
            own. Feeds your Learning recommendations and Coaching Notes.
          </p>
          <Suspense fallback={<SkillsToBuildSkeleton />}>
            <SkillsToBuildCard candidateId={profile.id} skillsToBuild={profile.skillsToBuild} />
          </Suspense>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Coming soon</h2>
        <p className="text-sm text-muted-foreground">
          The rest of the assessment roster — not built yet, listed here so the full picture is
          honest about what&apos;s ahead.
        </p>
        <div className="space-y-4">
          {UPCOMING_MODULES.map((module) => (
            <Card key={module.key} className="opacity-70">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-base font-medium text-foreground">{module.title}</CardTitle>
                <span className="shrink-0 rounded-full bg-light-gray px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Coming soon
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{module.description}</p>
                <p className="text-xs font-medium text-muted-foreground">{module.feeds}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
