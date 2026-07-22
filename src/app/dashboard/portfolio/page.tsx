import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NarrativeManager, type NarrativeItem } from '@/components/dashboard/portfolio/NarrativeManager'
import { MarketRealitySnapshotArchive } from '@/components/dashboard/MarketRealitySnapshotArchive'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import type { NamedReason } from '@/lib/scoring/named-reasons'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'

export default async function PortfolioPage() {
  const profile = await getDashboardData()

  const [narrativeRows, reportHistory, marketRealitySnapshots, coach] = await Promise.all([
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Portfolio</h1>
        <p className="mt-1 text-muted-foreground">
          Every artifact you&apos;ve built — your resume, story, reports, and dossiers — all in one
          place.
        </p>
      </div>

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
            <p className="text-sm text-muted-foreground">No resume uploaded yet.</p>
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
        <h2 className="text-sm font-medium text-muted-foreground">My Narrative</h2>
        <p className="text-sm text-muted-foreground">
          Your core story, adapted for LinkedIn, resumes, and interviews — and, if you need it, a
          separate version for a specific scenario.
        </p>
        <NarrativeManager narratives={narratives} />
      </div>

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
                const g = r.hireabilityGradeAtGeneration as unknown as HireabilityGrade | null
                return (
                  <li key={r.id} className="flex items-center justify-between text-foreground">
                    <span>{r.generatedAt.toLocaleDateString()}</span>
                    <span className="text-muted-foreground">
                      {g
                        ? `Market ${g.marketReality.grade}, Execution ${g.searchExecution.grade}`
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

      {profile.coachId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coach Dossier &amp; Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {hasCoachDossierAccess
                ? `Exactly what ${coach?.fullName ?? 'your coach'} sees when preparing for your sessions.`
                : "Turn on sharing in Privacy Settings to see what your coach would see."}
            </p>
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={<Link href={hasCoachDossierAccess ? '/dashboard/coach-dossier' : '/dashboard/privacy'} />}
            >
              {hasCoachDossierAccess ? 'View' : 'Privacy Settings'}
            </Button>
          </CardContent>
        </Card>
      )}

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
  )
}
