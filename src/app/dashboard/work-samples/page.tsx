import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EvidenceCard } from '@/components/dashboard/EvidenceCard'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { WorkSampleForm } from '@/components/dashboard/WorkSampleForm'
import { WorkSampleTypeGateForm } from '@/components/dashboard/WorkSampleTypeGateForm'
import { WorkHistoryForm } from '@/components/dashboard/WorkHistoryForm'
import { WorkHistoryList } from '@/components/dashboard/WorkHistoryList'
import { deleteWorkSample } from './actions'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { AI_SAMPLE_SPECS, aiSampleChecks, isAiSampleType } from '@/lib/evidence/ai-work-samples'
import { AiSampleReviewPanel } from '@/components/dashboard/AiSampleReviewPanel'
import { isAiReviewOn } from '@/lib/evidence/ai-review-flag'
import { loadSampleReviews } from '@/lib/evidence/ai-sample-review-server'
import { MAX_REVIEWS_PER_SAMPLE_PER_WEEK } from '@/lib/evidence/ai-sample-review'

export const metadata: Metadata = { title: 'Work Samples' }


export default async function WorkSamplesPage() {
  const profile = await getDashboardData()

  if (!profile.workSampleType) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Work Samples</h1>
          <PageHeaderBoxes pageKey="work-samples" candidateId={profile.id} />
        </div>
        <WorkSampleTypeGateForm alreadyAwarded={!!profile.workSampleTypeBonusAt} />
        <Suspense fallback={null}>
          <EvidenceCard candidateId={profile.id} />
        </Suspense>

        <div className="space-y-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your work history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Feeds your Certified Executive Dossier and What They See — fractional/interim/consulting roles
              are never labeled as such externally, so add them here without hesitation. Landing your
              first interim or fractional client also counts toward your Landed an Interim Role
              badge — see the full path on the{' '}
              <a href="/dashboard/find-my-job?types=part_time,contract,advisory#independent-work" className="text-primary underline underline-offset-4">
                Interim Work
              </a>{' '}
              page.
            </p>
          </div>
          <WorkHistoryList entries={profile.workHistory} />
          <WorkHistoryForm />
        </div>
      </div>
    )
  }

  if (profile.workSampleType === 'none') {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Work Samples</h1>
          <PageHeaderBoxes pageKey="work-samples" candidateId={profile.id} />
        </div>
        <WorkSampleTypeGateForm alreadyAwarded={!!profile.workSampleTypeBonusAt} />
        <Suspense fallback={null}>
          <EvidenceCard candidateId={profile.id} />
        </Suspense>

        <div className="space-y-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your work history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Feeds your Certified Executive Dossier and What They See — fractional/interim/consulting roles
              are never labeled as such externally, so add them here without hesitation. Landing your
              first interim or fractional client also counts toward your Landed an Interim Role
              badge — see the full path on the{' '}
              <a href="/dashboard/find-my-job?types=part_time,contract,advisory#independent-work" className="text-primary underline underline-offset-4">
                Interim Work
              </a>{' '}
              page.
            </p>
          </div>
          <WorkHistoryList entries={profile.workHistory} />
          <WorkHistoryForm />
        </div>
      </div>
    )
  }

  // AI reviews: owner-only until switched on (ai-review-flag.ts). Member-visible only.
  const reviewOn = isAiReviewOn(profile.email)
  const aiSamples = profile.workSamples.filter((w) => isAiSampleType(w.sampleType))
  const reviews = reviewOn ? await loadSampleReviews(profile.id, aiSamples.map((w) => w.id)) : null

  const aiWorkflowCount = profile.workSamples.filter((w) => aiSampleChecks(w)?.hasMetric).length

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Work Samples</h1>
        <PageHeaderBoxes pageKey="work-samples" candidateId={profile.id} />
        <p className="text-sm text-muted-foreground">
          AI work samples with a measured result: {aiWorkflowCount} of 3. Employers look for hands-on AI use in your own function, shown with a
          measured result — an automation with a before and after, an AI policy or use-case portfolio, or a RAG or agent project with an eval.
        </p>
      </div>

      <Suspense fallback={null}>
        <EvidenceCard candidateId={profile.id} />
      </Suspense>

      <WorkSampleForm />

      {profile.workSamples.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Your samples</h2>
          {profile.workSamples.map((sample) => (
            <Card key={sample.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div className="space-y-1">
                  <p className="font-medium">{sample.title}</p>
                  <p className="text-sm text-muted-foreground">{sample.description}</p>
                  {sample.sampleType === 'ai_workflow' && (sample.beforeMetric || sample.afterMetric) && (
                    <p className="text-sm text-foreground">
                      Before: {sample.beforeMetric ?? 'not given'}. After: {sample.afterMetric ?? 'not given'}.
                      {sample.aiToolsUsed ? ` Tools: ${sample.aiToolsUsed}.` : ''}
                    </p>
                  )}
                  {(() => {
                    // The proof-map checks an AI sample meets, and what would strengthen it.
                    const c = aiSampleChecks(sample)
                    if (!c) return null
                    return (
                      <p className="text-xs text-muted-foreground">
                        {AI_SAMPLE_SPECS[c.type].label}: {c.passed.length} of {c.passed.length + c.missing.length} checks
                        {c.missing.length > 0 ? ` — to strengthen it: ${c.missing.map((m) => m.label.toLowerCase()).join(', ')}` : ' — complete'}
                      </p>
                    )
                  })()}
                  {(sample.fileUrl || sample.externalUrl) && (
                    <a
                      href={sample.fileUrl ?? sample.externalUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      View
                    </a>
                  )}
                </div>
                <form action={deleteWorkSample.bind(null, sample.id)}>
                  <SubmitButton variant="ghost" size="sm">
                    Remove
                  </SubmitButton>
                </form>
              </CardContent>
              {reviews?.available && isAiSampleType(sample.sampleType) && (() => {
                const rev = reviews.latest[sample.id]
                const recent = (reviews.recent[sample.id] ?? []).sort((a, b) => a.getTime() - b.getTime())
                const remaining = Math.max(0, MAX_REVIEWS_PER_SAMPLE_PER_WEEK - recent.length)
                return (
                  <CardContent className="pb-6">
                    <AiSampleReviewPanel
                      sampleId={sample.id}
                      sampleType={sample.sampleType}
                      review={rev ? { verdict: rev.verdict, checks: rev.checks, summary: rev.summary, suggestions: rev.suggestions, createdAt: rev.createdAt.toISOString() } : null}
                      remaining={remaining}
                      nextAvailable={remaining === 0 && recent[0] ? new Date(recent[0].getTime() + 7 * 24 * 3600 * 1000).toISOString() : null}
                    />
                  </CardContent>
                )
              })()}
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your work history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Feeds your Certified Executive Dossier and What They See — fractional/interim/consulting roles
            are never labeled as such externally, so add them here without hesitation. Landing your
            first interim or fractional client also counts toward your Landed an Interim Role
            badge — see the full path on the{' '}
            <a href="/dashboard/find-my-job?types=part_time,contract,advisory#independent-work" className="text-primary underline underline-offset-4">
              Interim Work
            </a>{' '}
            page.
          </p>
        </div>
        <WorkHistoryList entries={profile.workHistory} />
        <WorkHistoryForm />
      </div>
    </div>
  )
}
