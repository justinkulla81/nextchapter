import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { cn } from '@/lib/utils'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList } from '@/components/candidate/RowList'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { nextAssessment, shapeAssessments } from '@/lib/redesign/assessments'

export const metadata: Metadata = { title: 'Skills & Behavioral Assessments' }

export default async function SkillsAssessmentsPage() {
  const profile = await getDashboardProfile()

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
  const workInterestsCompletedAt = profile.workInterestsCompletedAt

  const assessments = [
    {
      key: 'working-style',
      title: 'How I Work Best',
      description:
        'A quick self-report on your working style — how you operate, decide, and collaborate. Your references answer these same questions about you.',
      feeds: 'Feeds: Executive Dossier · Hiring Manager Notes · Coaching Notes',
      sharedWith:
        'Who sees it: your Coach, and — once your Executive Dossier is unlocked — recruiters and hiring managers.',
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
      feeds: 'Feeds: Market Reality Report category grades · Hiring Manager Notes',
      sharedWith:
        'Who sees it: your Coach, and — once your Executive Dossier is unlocked — recruiters and hiring managers. It also shapes your own Market Reality Report grades.',
      completedAt: latestPerformanceResponse?.completedAt ?? null,
      points: estimateActionEffort({ actionType: 'PERFORMANCE_ASSESSMENT_COMPLETED' }).points,
      href: '/dashboard/how-i-perform',
      ctaLabel: latestPerformanceResponse ? 'Retake' : 'Take the assessment',
    },
    {
      key: 'skills',
      title: 'Skills Assessment',
      // Unlocks the most of any assessment here (personalized Learning
      // page, Job/Skills Recommendations, Market Reality Report) — flagged
      // as priority and pinned first in the list below so candidates do
      // this one first, not buried under others by completion status.
      priority: true,
      description:
        'A candid self-read on your core function, AI fluency, and a few other skills that drive how jobs and courses get matched to you.',
      feeds: 'Feeds: Job Recommendations · Skills Recommendations · Market Reality Report · Learning',
      sharedWith: 'Who sees it: no one — personalization only, used to match jobs and courses to you.',
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
      sharedWith:
        'Who sees it: your Coach, and — once your Executive Dossier is unlocked — recruiters and hiring managers.',
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
      sharedWith: 'Who sees it: your Coach. Otherwise personalization only, used to shape your own Search Strategy.',
      completedAt: whatINeedCompletedAt,
      points: estimateActionEffort({ actionType: 'WHAT_I_NEED_COMPLETED' }).points,
      href: '/dashboard/what-i-need',
      ctaLabel: whatINeedCompletedAt ? 'Retake' : 'Take the assessment',
    },
    {
      key: 'work-interests',
      title: 'Work Interests',
      description:
        'What kind of work actually energizes you, based on the Holland RIASEC framework used across career counseling (O*NET Interest Profiler).',
      feeds: 'Feeds: Job Recommendations · Learning recommendations',
      sharedWith: 'Who sees it: no one — personalization only, used to match jobs and courses to you.',
      completedAt: workInterestsCompletedAt,
      points: estimateActionEffort({ actionType: 'WORK_INTERESTS_COMPLETED' }).points,
      href: '/dashboard/work-interests',
      ctaLabel: workInterestsCompletedAt ? 'Retake' : 'Take the assessment',
    },
    {
      key: 'reference-check',
      title: 'Reference Check',
      description:
        'The people who worked with you rate the same things you rated yourself on — the comparison is what a hiring manager actually wants to see.',
      feeds: 'Feeds: Hiring Manager Notes · self-vs-reference friction · Executive Dossier',
      sharedWith:
        'Who sees it: always shared — the references you invite see and answer these questions about you, and, once your Executive Dossier is unlocked, hiring managers see the comparison to your own answers.',
      completedAt: completedReferenceCount > 0 ? new Date(0) : null,
      // 3 is the reference target (DOSSIER_UNLOCK_REFERENCE_TARGET) shown so
      // candidates know how many to request. Not a Candidate+ gate since
      // 2026-10-16; references count toward Candidate+ Verified.
      statusLabel:
        completedReferenceCount > 0 ? `${completedReferenceCount} / 3 references` : 'Not completed yet',
      points: estimateActionEffort({ actionType: 'REFERENCE_ADDED' }).points,
      href: '/dashboard/references',
      ctaLabel: completedReferenceCount > 0 ? 'Manage references' : 'Request references',
    },
    // Not-completed-first is the one thing actually asking for attention
    // on this page — that holds even for Skills Assessment (it unlocks the
    // most downstream personalization, so it's pinned ahead of the other
    // not-yet-done items while it's still outstanding), but the pin stops
    // applying once it's done: a completed item never sits above an
    // incomplete one just because it used to be the priority.
  ].sort((a, b) => {
    const aPinned = 'priority' in a && a.priority && !a.completedAt
    const bPinned = 'priority' in b && b.priority && !b.completedAt
    if (aPinned && !bPinned) return -1
    if (bPinned && !aPinned) return 1
    return Number(!!a.completedAt) - Number(!!b.completedAt)
  })

  if (isRedesignOn(profile.email)) {
    // How I work in the redesign: one list, each row with its reason and its time, and the best next one as the action.
    const rows = shapeAssessments(assessments)
    const next = nextAssessment(rows)
    const byKey = new Map(assessments.map((a) => [a.key, a]))
    return (
      <div className="space-y-8">
        <PageHeader
          title="How I work"
          intro="Short assessments that sharpen your job matches and add proof to your dossier. Each one says what it gets you."
          action={
            next ? (
              <ActionLink href={next.href} event="assessment_started" props={{ assessment: next.key, source: 'how_i_work_header' }}>
                Start next: {next.title}
              </ActionLink>
            ) : undefined
          }
        />
        {!next && <p className="rounded-2xl bg-muted/60 p-5 text-base text-ink">You have finished every assessment. Retake one any time your answers change, and your matches follow.</p>}
        <Section id="assessments" title="Your assessments">
          <RowList
            label="Assessments"
            items={rows.map((r) => {
              const a = byKey.get(r.key)!
              return {
                key: r.key,
                title: r.title,
                why: r.why,
                fact: r.fact,
                actions: (
                  <ActionLink href={r.href} variant="secondary" event="assessment_started" props={{ assessment: r.key, retake: r.done, source: 'how_i_work_row' }}>
                    {r.ctaLabel}
                  </ActionLink>
                ),
                detailLabel: 'Who sees this',
                detail: (
                  <>
                    <p>{a.description}</p>
                    <p>{a.feeds}</p>
                    <p>{a.sharedWith}</p>
                  </>
                ),
              }
            })}
          />
          <p className="text-sm text-muted-foreground">1 point is 1 minute of real search work, so finishing an assessment also counts toward Candidate+.</p>
        </Section>
        <MoreDetails summary="Show more: a work sample you can share">
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-ink">noexperienceneeded.ai: AI work-sample challenge</h2>
            <p className="text-base text-ink">Produces a shareable work sample for your evidence file, so employers see what you can do. You can also start with the lesson.</p>
            <div className="flex flex-wrap gap-3">
              <ActionLink href="/noexperience/test?src=nc_assessment" variant="secondary" event="work_sample_challenge_started" props={{ source: 'how_i_work' }}>Take the challenge</ActionLink>
              <ActionLink href="/noexperience/lesson?src=nc_assessment" variant="secondary" event="work_sample_lesson_started" props={{ source: 'how_i_work' }}>Take the lesson</ActionLink>
            </div>
          </div>
        </MoreDetails>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Skills & Behavioral Assessments</h1>
        <p className="text-muted-foreground">
          Your skills and personality assessment for better job matches — these personalize your
          Job Recommendations, Skills Recommendations, and Market Reality Report — the more current
          they are, the better the matches.
        </p>
        <PageHeaderBoxes pageKey="skills-assessments" candidateId={profile.id} />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Your Assessments</h2>
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
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{assessment.title}</p>
                      {'priority' in assessment && assessment.priority && (
                        <span className="shrink-0 rounded-full bg-orange/15 px-2 py-0.5 text-xs font-medium text-orange">
                          Priority
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'truncate text-xs',
                        assessment.completedAt ? 'font-medium text-success' : 'text-muted-foreground'
                      )}
                    >
                      {statusLine}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {!assessment.completedAt && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand tabular-nums">
                        +{assessment.points} pts
                      </span>
                    )}
                    <Button nativeButton={false} render={<Link href={assessment.href} />} size="sm">
                      {assessment.ctaLabel}
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground underline underline-offset-4">
                      See details
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </div>
                </summary>
                <div className="space-y-3 border-t border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">{assessment.description}</p>
                  <p className="text-xs font-medium text-muted-foreground">{assessment.feeds}</p>
                  <p className="text-xs font-medium text-muted-foreground">{assessment.sharedWith}</p>

                  {assessment.key === 'skills' && (
                    <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                      Skills You Have and Skills You Need to Build now live on the assessment itself —
                      confirm them right after you answer the questions above.
                    </p>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground">noexperienceneeded.ai: AI Work-Sample Challenge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Produces a shareable work sample for your Evidence file. Or start with the lesson.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/noexperience/test?src=nc_assessment" />} size="sm">
              Take the challenge
            </Button>
            <Button nativeButton={false} render={<Link href="/noexperience/lesson?src=nc_assessment" />} size="sm" variant="outline">
              Take the lesson
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
