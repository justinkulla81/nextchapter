import type { Metadata } from 'next'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { NarrativeItem } from '@/components/dashboard/portfolio/NarrativeManager'
import { buildPortfolioAssetChecklist } from '@/lib/portfolio/asset-checklist'
import { normalizeGradeSnapshot } from '@/lib/scoring/dossier-competencies'
import { computeDossierCompetencies, type CandidateWithGradeRelations } from '@/lib/scoring/dossier-competencies'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { CoachingCTACard } from '@/components/dashboard/CoachingCTACard'

export const metadata: Metadata = { title: 'My Portfolio' }


const RESUME_UPDATE_POINTS = estimateActionEffort({ actionType: 'RESUME_UPDATE' }).points

export default async function PortfolioPage() {
  const profile = await getDashboardData()

  const [narrativeRows, reportHistory, marketRealitySnapshots, coach, grade, learningBadgeCount] =
    await Promise.all([
      prisma.candidateNarrative.findMany({
        where: { candidateId: profile.id },
        orderBy: { generatedAt: 'asc' },
      }),
      prisma.marketRealityReport.findMany({
        where: { candidateId: profile.id },
        orderBy: { generatedAt: 'desc' },
        take: 6,
        select: { id: true, generatedAt: true, dossierGradeAtGeneration: true },
      }),
      prisma.marketRealitySnapshot.findMany({
        where: { candidateId: profile.id },
        orderBy: { weekStartDate: 'asc' },
      }),
      profile.coachId
        ? prisma.coach.findUnique({ where: { id: profile.coachId }, select: { fullName: true } })
        : null,
      computeDossierCompetencies(profile as unknown as CandidateWithGradeRelations),
      prisma.learningBadge.count({ where: { candidateId: profile.id } }),
    ])

  const narratives: NarrativeItem[] = narrativeRows.map((n, i) => ({
    id: n.id,
    label: n.label,
    coreStatement: n.coreStatement,
    adaptations: (n.adaptations as unknown as NarrativeAdaptations | null) ?? null,
    isDefault: i === 0,
  }))

  const latestResume = profile.resumes[0]
  const coverLettersCount = profile.jobPostings.filter((j) => !!j.coverLetter).length
  const hasCoachDossierAccess = profile.coachId !== null && profile.coachDossierConsentedAt !== null
  const isAList = grade.grade === 'A'
  const completedReferenceCount = profile.references.filter((r) => r.status === 'COMPLETED').length

  // Same categories the "My Portfolio" nav badge counts (see
  // portfolioAssetCount in dashboard/layout.tsx, built from the same
  // buildPortfolioAssetChecklist) — surfaced here so the number in the nav
  // has a legible meaning on the page itself instead of just being an
  // unexplained count.
  const coreAssets = buildPortfolioAssetChecklist({
    hasResume: profile.resumes.length > 0,
    hasCoverLetter: coverLettersCount > 0,
    hasNarrative: narratives.length > 0,
    hasMarketRealityReport: reportHistory.length > 0,
    hasMarketRealitySnapshot: marketRealitySnapshots.length > 0,
    hasWorkSample: profile.workSamples.length > 0,
    hasCompletedReference: completedReferenceCount > 0,
    hasLearningBadge: learningBadgeCount > 0,
  })
  const completedAssetCount = coreAssets.filter((a) => a.done).length

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">My Portfolio</h1>
        <PageHeaderBoxes pageKey="portfolio" candidateId={profile.id} />
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-foreground tabular-nums">
            {completedAssetCount} of {coreAssets.length} core assets built
          </p>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {coreAssets.map((a) => (
              <li key={a.key} className="flex items-center gap-2">
                <span className={a.done ? 'text-success' : 'text-muted-foreground'} aria-hidden>
                  {a.done ? '✓' : '○'}
                </span>
                <span className={a.done ? 'text-foreground' : 'text-muted-foreground'}>{a.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Reports &amp; Dossiers
        </h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Market Reality Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your full narrative report, plus the week-by-week history and trend behind it.
            </p>
            {reportHistory.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="text-sm">
                  <p className="font-medium text-foreground">Full report</p>
                  <p className="text-xs text-muted-foreground">
                    {reportHistory[0].generatedAt.toLocaleDateString()}
                    {(() => {
                      const g = normalizeGradeSnapshot(reportHistory[0].dossierGradeAtGeneration)
                      return g ? ` — Grade ${g.grade}` : ''
                    })()}
                  </p>
                </div>
                <Button
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                  render={<Link href="/dashboard/market-reality" />}
                >
                  View full report
                </Button>
              </div>
            )}
            <Link
              href="/dashboard/stats#market-reality"
              className="inline-block text-sm text-primary underline underline-offset-4"
            >
              See weekly history &amp; trend →
            </Link>
          </CardContent>
        </Card>

        {isAList ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Executive Dossier</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                What recruiters and hiring managers see when you share your profile with them.
              </p>
              <Button
                nativeButton={false}
                size="sm"
                variant="outline"
                render={<Link href="/dashboard/recruiter-report" />}
              >
                View
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 rounded-lg border border-dashed border-light-gray bg-off-white p-4">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-orange" />
              <p className="text-sm font-medium text-orange">Executive Dossier — locked</p>
            </div>
            <p className="text-sm text-muted-foreground">
              What recruiters and hiring managers would see when you share your profile with them.
            </p>
            <p className="text-sm text-muted-foreground">
              Reach an A grade to unlock it — your current grade is{' '}
              <span className="font-semibold text-foreground">{grade.grade}</span>.
            </p>
          </div>
        )}

        {profile.coachId &&
          (hasCoachDossierAccess ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Coach Dossier &amp; Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Exactly what {coach?.fullName ?? 'your coach'} sees when preparing for your sessions.
                </p>
                <Button
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                  render={<Link href="/dashboard/coach-dossier" />}
                >
                  View
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 rounded-lg border border-dashed border-light-gray bg-off-white p-4">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-orange" />
                <p className="text-sm font-medium text-orange">Coach Dossier &amp; Notes — locked</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Turn on sharing to see exactly what your coach sees when preparing for your
                sessions. Without it, they walk in blind — no grade history, no named strengths or
                gaps — which means less time coaching and more time re-explaining your background.
              </p>
              <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/privacy" />}>
                Turn on sharing
              </Button>
            </div>
          ))}

        {!profile.coachId && <CoachingCTACard />}
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Your Assets
        </h2>
        <p className="text-sm text-muted-foreground">
          What you can hand to a recruiter, hiring manager, or coach — your prep for tough
          interview questions lives on{' '}
          <Link href="/dashboard/interview-prep" className="underline">
            Interview Prep
          </Link>{' '}
          instead.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Resume</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            {latestResume ? (
              <p className="text-sm text-foreground">
                {latestResume.fileName}
                {profile.resumes.length > 1 && (
                  <span className="text-muted-foreground"> · {profile.resumes.length} versions</span>
                )}
              </p>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">No resume uploaded yet.</p>
                <p className="text-xs font-medium text-muted-foreground tabular-nums">
                  +{RESUME_UPDATE_POINTS} pts toward this week&apos;s goal when you update it
                </p>
              </div>
            )}
            <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/resume" />}>
              {latestResume ? 'View versions' : 'Upload resume'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Cover Letters</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              {coverLettersCount > 0
                ? `${coverLettersCount} generated, one per job you've applied to`
                : "Generated automatically as you apply — none yet"}
            </p>
            <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/find-my-job" />}>
              {coverLettersCount > 0 ? 'View' : 'Create for a specific job'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">My Narrative</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {narratives.length > 0
                ? `${narratives.length} narrative${narratives.length === 1 ? '' : 's'} drafted — your core story, adapted for LinkedIn, resumes, and interviews.`
                : "Your core story, adapted for LinkedIn, resumes, and interviews — not drafted yet."}
            </p>
            <Button nativeButton={false} render={<Link href="/dashboard/marketing-plan" />} size="sm">
              {narratives.length > 0 ? 'Manage' : 'Draft it'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Work Samples</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {profile.workSamples.length > 0
                ? `${profile.workSamples.length} sample${profile.workSamples.length === 1 ? '' : 's'} uploaded`
                : 'Real work product that backs up your story.'}
            </p>
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={<Link href="/dashboard/work-samples" />}
            >
              {profile.workSamples.length > 0 ? 'View' : 'Add a sample'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">References</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {completedReferenceCount > 0
                ? `${completedReferenceCount} / 5 completed`
                : "Someone else's word for it — none received yet."}
            </p>
            <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/references" />}>
              {completedReferenceCount > 0 ? 'View' : 'Request a reference'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Learning Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {learningBadgeCount > 0
                ? `${learningBadgeCount} credential${learningBadgeCount === 1 ? '' : 's'} logged`
                : 'A course, certification, or project worth mentioning.'}
            </p>
            <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/learning" />}>
              {learningBadgeCount > 0 ? 'View' : 'Add a credential'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
