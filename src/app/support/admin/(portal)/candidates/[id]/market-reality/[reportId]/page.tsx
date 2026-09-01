import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatAdminDateTime } from '@/lib/admin/format-date'

interface TitleDetail {
  title: string
  detail: string
}
interface BeforeAfter {
  before: string
  after: string
}
interface HillToClimb {
  tone: string
  narrative: string[]
}
interface ActionPlanItem {
  text: string
  actionType?: string
}
interface ActionPlanDay {
  day: number
  items: ActionPlanItem[]
}
interface Gap {
  area: string
  why: string
  remediation: string
  remediationType: string
}
interface GapAnalysis {
  targetRole: string
  gaps: Gap[]
}
interface MarketConditions {
  narrative: string[]
}
interface ExecutiveSummary {
  improvementNarrative: string[]
  whatToDoMore: string[]
}

// Admin-only, read-only view of one MarketRealityReport's raw content —
// there's no admin equivalent of the candidate's own polished
// /dashboard/market-reality page (853 lines, tightly coupled to session
// auth and candidate-only actions like regenerate/resend), so this reads
// the report's fields directly instead of trying to replicate that UI.
// Good enough for support/debugging: confirm a report generated, read what
// it actually said.
export default async function AdminMarketRealityReportPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>
}) {
  await requireAdmin()
  const { id, reportId } = await params

  const report = await prisma.marketRealityReport.findUnique({
    where: { id: reportId },
    include: { candidate: { select: { firstName: true, lastName: true } } },
  })
  if (!report || report.candidateId !== id) notFound()

  const strengths = report.strengths as unknown as TitleDetail[]
  const weaknesses = report.weaknesses as unknown as TitleDetail[]
  const actionPlan = report.actionPlan as unknown as ActionPlanDay[]
  const gapAnalysis = report.gapAnalysis as unknown as GapAnalysis
  const marketConditions = report.marketConditions as unknown as MarketConditions | null
  const hillToClimb = report.hillToClimb as unknown as HillToClimb | null
  const executiveSummary = report.executiveSummary as unknown as ExecutiveSummary | null
  const resumeRewrites = report.resumeRewrites as unknown as BeforeAfter[] | null

  const candidateName = [report.candidate.firstName, report.candidate.lastName].filter(Boolean).join(' ') || 'This candidate'

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href={`/support/admin/candidates/${id}`} className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to {candidateName}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market Reality Report</h1>
        <p className="mt-1 text-muted-foreground">
          {candidateName} · Generated {formatAdminDateTime(report.generatedAt)}
          {report.emailSentAt && ` · Emailed ${formatAdminDateTime(report.emailSentAt)}`}
        </p>
      </div>

      {executiveSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Executive summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <ul className="ml-4 list-disc space-y-1">
              {executiveSummary.improvementNarrative.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p className="font-medium text-muted-foreground">What to do more of</p>
            <ul className="ml-4 list-disc space-y-1">
              {executiveSummary.whatToDoMore.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Strengths</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {strengths.map((s, i) => (
            <div key={i} className="text-sm">
              <p className="font-medium text-foreground">{s.title}</p>
              <p className="text-muted-foreground">{s.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weaknesses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {weaknesses.map((w, i) => (
            <div key={i} className="text-sm">
              <p className="font-medium text-foreground">{w.title}</p>
              <p className="text-muted-foreground">{w.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {resumeRewrites && resumeRewrites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resume rewrites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {resumeRewrites.map((r, i) => (
              <div key={i} className="space-y-1 text-sm">
                <p>
                  <span className="font-medium text-muted-foreground">Before: </span>
                  {r.before}
                </p>
                <p>
                  <span className="font-medium text-muted-foreground">After: </span>
                  {r.after}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hillToClimb && (
        <Card>
          <CardHeader>
            <CardTitle>Hill to climb — {hillToClimb.tone.replace(/_/g, ' ')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="ml-4 list-disc space-y-1 text-sm text-foreground">
              {hillToClimb.narrative.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gap analysis — target: {gapAnalysis.targetRole}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {gapAnalysis.gaps.map((g, i) => (
            <div key={i} className="text-sm">
              <p className="font-medium text-foreground">
                {g.area} <span className="font-normal text-muted-foreground">({g.remediationType.replace(/_/g, ' ')})</span>
              </p>
              <p className="text-muted-foreground">Why: {g.why}</p>
              <p className="text-foreground">Fix: {g.remediation}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {marketConditions && (
        <Card>
          <CardHeader>
            <CardTitle>Market conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="ml-4 list-disc space-y-1 text-sm text-foreground">
              {marketConditions.narrative.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>7-day action plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionPlan.map((d) => (
            <div key={d.day} className="text-sm">
              <p className="font-medium text-foreground">Day {d.day}</p>
              <ul className="ml-4 list-disc space-y-0.5 text-muted-foreground">
                {d.items.map((item, i) => (
                  <li key={i}>{item.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
