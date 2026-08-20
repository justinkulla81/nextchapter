import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { ResumeUploadForm } from '@/components/dashboard/ResumeUploadForm'
import { ResumeVersionsList, type ResumeVersionItem } from '@/components/dashboard/ResumeVersionsList'
import { ResumeExportForm } from '@/components/dashboard/ResumeExportForm'
import { ResumeFeedbackCard } from '@/components/dashboard/ResumeFeedbackCard'
import { ResumeFixCard } from '@/components/dashboard/ResumeFixCard'
import { ResumeViewButton } from '@/components/dashboard/ResumeViewButton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { getResumeFixes } from '@/lib/reports/market-reality-sections'
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
    <ResumeViewButton
      signedUrl={data.signedUrl}
      title="Resume"
      className="text-sm text-primary underline underline-offset-4"
    >
      View
    </ResumeViewButton>
  )
}

async function resolveVersionUrls(resumes: { id: string; filePath: string }[]): Promise<Map<string, string>> {
  const admin = createAdminClient()
  const entries = await Promise.all(
    resumes.map(async (r) => {
      const { data } = await admin.storage.from('resumes').createSignedUrl(r.filePath, 60 * 10)
      return [r.id, data?.signedUrl ?? null] as const
    })
  )
  return new Map(entries.filter((e): e is [string, string] => !!e[1]))
}

export default async function ResumePage({
  searchParams,
}: {
  searchParams: Promise<{ fromGap?: string }>
}) {
  const [profile, { fromGap }] = await Promise.all([getDashboardData(), searchParams])

  const latest = profile.resumes[0]

  // Same itemized dimension-finding fixes shown on the Market Reality
  // Report (getResumeFixes) — surfaced here too so they're addressable
  // right where the candidate actually edits/re-uploads their resume,
  // not only as read-only findings on a separate report page.
  const [latestReport, versionUrls, narratives] = await Promise.all([
    prisma.marketRealityReport.findFirst({
      where: { candidateId: profile.id },
      orderBy: { generatedAt: 'desc' },
      select: { resumeRewrites: true },
    }),
    resolveVersionUrls(profile.resumes),
    prisma.candidateNarrative.findMany({
      where: { candidateId: profile.id },
      orderBy: { generatedAt: 'asc' },
      select: { id: true, label: true },
    }),
  ])
  const resumeFixes = await getResumeFixes(profile.id, latestReport?.resumeRewrites ?? null)

  const versions: ResumeVersionItem[] = profile.resumes.map((resume, i) => ({
    id: resume.id,
    fileName: resume.fileName,
    label: resume.label,
    description: resume.description,
    uploadedAt: resume.uploadedAt,
    isLatest: i === 0,
    signedUrl: versionUrls.get(resume.id) ?? null,
  }))

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Resume</h1>
        <PageHeaderBoxes pageKey="resume" candidateId={profile.id} />
      </div>

      <ResumeVersionsList versions={versions} />

      <ResumeUploadForm narratives={narratives} />

      {latest && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div className="space-y-1">
              <p className="font-medium text-foreground">Want us to walk you through fixing it?</p>
              <p className="text-sm text-muted-foreground">
                The Resume Fixer — a guided, one-issue-at-a-time pass, about 18 minutes. Nothing changes
                until you approve it.
              </p>
            </div>
            <Button nativeButton={false} render={<Link href="/dashboard/resume/walkthrough" />}>
              Open the Resume Fixer
              <ArrowRight className="size-4" aria-hidden data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      )}

      {latest && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">Resume Analysis</p>
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="flex items-center justify-between">
                <p className="font-medium">{latest.label || latest.fileName}</p>
                <Suspense fallback={null}>
                  <ResumeViewLink filePath={latest.filePath} />
                </Suspense>
              </div>

              {latest.analysisError && (
                <p className="text-sm text-destructive">{latest.analysisError}</p>
              )}

              {latest.atsScore !== null && (
                <div className="space-y-2">
                  {asFeedbackItems(latest.atsFeedback).map((item, i) => (
                    <ResumeFeedbackCard key={i} item={item} />
                  ))}
                </div>
              )}

              {latest.resultsScore !== null && (
                <div className="space-y-2">
                  {asFeedbackItems(latest.resultsFeedback).map((item, i) => (
                    <ResumeFeedbackCard key={i} item={item} />
                  ))}
                </div>
              )}

              {latest.experienceScore !== null && (
                <div id="action-plan" className="space-y-2">
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

      {resumeFixes && resumeFixes.items.length > 0 && (
        <div id="resume-fixes" className="scroll-mt-4 space-y-4">
          <p className="text-sm font-medium text-muted-foreground">Itemized resume fixes</p>
          <Card>
            <CardContent className="space-y-3 pt-6">
              {resumeFixes.items.map((item, i) => (
                <ResumeFixCard key={i} item={item} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <ResumeExportForm />

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
    </div>
  )
}
