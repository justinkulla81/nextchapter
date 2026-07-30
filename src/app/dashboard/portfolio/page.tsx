import Link from 'next/link'
import { Lock } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NarrativeManager, type NarrativeItem } from '@/components/dashboard/portfolio/NarrativeManager'
import { WeaknessGuidanceCard } from '@/components/dashboard/portfolio/WeaknessGuidanceCard'
import { MarketRealitySnapshotArchive } from '@/components/dashboard/MarketRealitySnapshotArchive'
import { detectNarrativeWeaknesses } from '@/lib/narrative/detect-narrative-weaknesses'
import type { Grade } from '@/lib/scoring/grade'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import { computeHireabilityGrade, type CandidateWithGradeRelations } from '@/lib/scoring/hireability-grade'
import type { NamedReason } from '@/lib/scoring/named-reasons'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'
import { estimateActionEffort } from '@/lib/weekly/action-effort'

const RESUME_UPDATE_POINTS = estimateActionEffort({ actionType: 'RESUME_UPDATE' }).points

export default async function PortfolioPage() {
  const profile = await getDashboardData()

  const [narrativeRows, reportHistory, marketRealitySnapshots, coach, grade, weaknessGuidance] = await Promise.all([
    prisma.candidateNarrative.findMany({
      where: { candidateId: profile.id },
      orderBy: { generatedAt: 'asc' },
    }),
    prisma.hireabilityReport.findMany({
      where: { candidateId: profile.id },
      orderBy: { generatedAt: 'desc' },
      take: 6,
      select: { id: true, generatedAt: true, hireabilityGradeAtGeneration: true },
    }),
    prisma.marketRealitySnapshot.findMany({
      where: { candidateId: profile.id },
      orderBy: { weekStartDate: 'asc' },
    }),
    profile.coachId
      ? prisma.coach.findUnique({ where: { id: profile.coachId }, select: { fullName: true } })
      : null,
    computeHireabilityGrade(profile as unknown as CandidateWithGradeRelations),
    detectNarrativeWeaknesses(profile.id),
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

  // Same six categories the "My Portfolio" nav badge counts (see
  // portfolioAssetCount in dashboard/layout.tsx) — surfaced here so the
  // number in the nav has a legible meaning on the page itself instead of
  // just being an unexplained count.
  const coreAssets = [
    { label: 'Resume', done: profile.resumes.length > 0 },
    { label: 'A cover letter', done: coverLettersCount > 0 },
    { label: 'Your narrative', done: narratives.length > 0 },
    { label: 'Hireability Report', done: reportHistory.length > 0 },
    { label: 'Market Reality Report', done: marketRealitySnapshots.length > 0 },
    { label: 'A work sample', done: profile.workSamples.length > 0 },
  ]
  const completedAssetCount = coreAssets.filter((a) => a.done).length
  const missingAssets = coreAssets.filter((a) => !a.done)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Portfolio</h1>
        <p className="mt-1 text-muted-foreground">
          Every artifact you&apos;ve built — your resume, story, reports, and dossiers — all in one
          place.
        </p>
        <p className="mt-2 text-sm font-medium text-muted-foreground tabular-nums">
          {completedAssetCount} of {coreAssets.length} core assets built
          {missingAssets.length > 0 && (
            <span className="font-normal"> — still need: {missingAssets.map((a) => a.label).join(', ')}</span>
          )}
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Your Documents
        </h2>

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
              {coverLettersCount > 0 ? 'View' : 'Find a job'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">My Narrative</h3>
          <p className="text-sm text-muted-foreground">
            Your core story, adapted for LinkedIn, resumes, and interviews — and, if you need it, a
            separate version for a specific scenario.
          </p>
          <NarrativeManager narratives={narratives} />
        </div>

        <WeaknessGuidanceCard
          guidance={weaknessGuidance}
          showGapForm
          gapExplanation={profile.gapExplanation}
          includeGapExplanationInDossier={profile.includeGapExplanationInDossier}
        />

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
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Reports &amp; Dossiers
        </h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Hireability Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No report generated yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {reportHistory.map((r) => {
                  const g = normalizeGradeSnapshot(r.hireabilityGradeAtGeneration)
                  return (
                    <li key={r.id} className="flex items-center justify-between text-foreground">
                      <span>{r.generatedAt.toLocaleDateString()}</span>
                      <span className="text-muted-foreground">
                        {g
                          ? `Grade ${g.grade}`
                          : '—'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={<Link href="/dashboard/hireability-report" />}
            >
              View full report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Market Reality Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MarketRealitySnapshotArchive
              snapshots={[...marketRealitySnapshots].reverse().map((s) => ({
                id: s.id,
                weekStartDate: s.weekStartDate,
                grade: s.grade as Grade,
                namedReasons: s.namedReasons as unknown as NamedReason[],
              }))}
            />
            <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/stats" />}>
              View trend over time
            </Button>
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
                Turn on sharing in Privacy Settings to see exactly what your coach sees when preparing
                for your sessions.
              </p>
              <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/privacy" />}>
                Privacy Settings
              </Button>
            </div>
          ))}
      </div>
    </div>
  )
}
