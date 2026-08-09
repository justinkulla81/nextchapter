import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResumeUploadForm } from '@/components/dashboard/ResumeUploadForm'
import { ResumeFeedbackCard } from '@/components/dashboard/ResumeFeedbackCard'
import { Card, CardContent } from '@/components/ui/card'
import { scoreToGrade, GRADE_LABEL } from '@/lib/scoring/grade'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import type { ResumeFeedbackItem } from '@/lib/resume/analyze-resume'

export const metadata: Metadata = { title: 'My Resume' }


function asFeedbackItems(value: unknown): ResumeFeedbackItem[] {
  return value as unknown as ResumeFeedbackItem[]
}

// Resolving a signed URL is a live Supabase Storage API call per resume —
// previously awaited for every resume before the page could render at all.
// Isolated per-link in its own Suspense boundary (fallback: nothing) so the
// actual analysis content (scores, feedback) renders immediately and each
// "View" link just pops in once its own signed URL resolves.
async function ResumeViewLink({ filePath }: { filePath: string }) {
  const admin = createAdminClient()
  const { data } = await admin.storage.from('resumes').createSignedUrl(filePath, 60 * 10)
  if (!data?.signedUrl) return null
  return (
    <a
      href={data.signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-primary underline underline-offset-4"
    >
      View
    </a>
  )
}

export default async function ResumePage({
  searchParams,
}: {
  searchParams: Promise<{ fromGap?: string }>
}) {
  const profile = await getDashboardData()
  const { fromGap } = await searchParams

  const latest = profile.resumes[0]

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Resume</h1>
        <PageHeaderBoxes pageKey="resume" candidateId={profile.id} />
      </div>

      <ResumeUploadForm />

      {latest && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Resume Analysis</h2>
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="flex items-center justify-between">
                <p className="font-medium">{latest.fileName}</p>
                <Suspense fallback={null}>
                  <ResumeViewLink filePath={latest.filePath} />
                </Suspense>
              </div>

              {latest.analysisError && (
                <p className="text-sm text-destructive">{latest.analysisError}</p>
              )}

              {latest.atsScore !== null && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    ATS readability: {scoreToGrade(latest.atsScore)}{' '}
                    <span className="text-muted-foreground">
                      ({GRADE_LABEL[scoreToGrade(latest.atsScore)]})
                    </span>
                  </p>
                  <div className="space-y-2">
                    {asFeedbackItems(latest.atsFeedback).map((item, i) => (
                      <ResumeFeedbackCard key={i} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {latest.resultsScore !== null && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Results orientation: {scoreToGrade(latest.resultsScore)}{' '}
                    <span className="text-muted-foreground">
                      ({GRADE_LABEL[scoreToGrade(latest.resultsScore)]})
                    </span>
                  </p>
                  <div className="space-y-2">
                    {asFeedbackItems(latest.resultsFeedback).map((item, i) => (
                      <ResumeFeedbackCard key={i} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {latest.experienceScore !== null && (
                <div id="action-plan" className="space-y-2">
                  <p className="text-sm font-medium">
                    Experience evaluation: {scoreToGrade(latest.experienceScore)}{' '}
                    <span className="text-muted-foreground">
                      ({GRADE_LABEL[scoreToGrade(latest.experienceScore)]})
                    </span>
                  </p>
                  {fromGap && (
                    <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      From your Market Reality Report: <span className="italic">&ldquo;{fromGap}&rdquo;</span> — the
                      items below are what to fix on the resume itself.
                    </p>
                  )}
                  <div className="space-y-2">
                    {asFeedbackItems(latest.experienceFeedback).map((item, i) => (
                      <ResumeFeedbackCard key={i} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {!latest.atsScore && !latest.analysisError && (
                <p className="text-sm text-muted-foreground">Analyzing…</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">What senior-level resume design looks like</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Single column, no tables, sidebars, or text boxes — they read fine to a human but often scramble or drop content in an ATS.</li>
          <li>No photo, icons, or graphics — they don&apos;t parse, and at this level they read as junior template design, not polish.</li>
          <li>Generous whitespace over dense text — a cluttered page reads as unedited, not thorough.</li>
          <li>One consistent font and size scale throughout — mixed fonts are one of the fastest ways a resume reads as unpolished.</li>
        </ul>
      </div>

      <div className="rounded-md border border-border bg-off-white p-3">
        <p className="text-sm text-foreground">
          Want a professional set of eyes on the writing and design, not just this automated read?
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <a
            href="https://enhancv.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-4"
          >
            Enhancv
          </a>
          <a
            href="https://findmyprofession.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-4"
          >
            Find My Profession (executive resume writers)
          </a>
        </div>
      </div>

      {profile.resumes.length > 1 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Previous uploads</h2>
          {profile.resumes.slice(1).map((resume) => (
            <Card key={resume.id}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-medium">{resume.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {resume.uploadedAt.toLocaleDateString()}
                  </p>
                </div>
                <Suspense fallback={null}>
                  <ResumeViewLink filePath={resume.filePath} />
                </Suspense>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  )
}
