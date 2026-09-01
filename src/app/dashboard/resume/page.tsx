import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { ResumeUploadForm } from '@/components/dashboard/ResumeUploadForm'
import { ResumeVersionsList, type ResumeVersionItem } from '@/components/dashboard/ResumeVersionsList'
import { ResumeExportForm } from '@/components/dashboard/ResumeExportForm'
import { ResumeFixCard } from '@/components/dashboard/ResumeFixCard'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { getResumeFixes } from '@/lib/reports/market-reality-sections'
import type { ResumeFeedbackItem } from '@/lib/resume/analyze-resume'

export const metadata: Metadata = { title: 'My Resume' }


function asFeedbackItems(value: unknown): ResumeFeedbackItem[] {
  return value as unknown as ResumeFeedbackItem[]
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
    atsScore: resume.atsScore,
    atsFeedback: asFeedbackItems(resume.atsFeedback),
    resultsScore: resume.resultsScore,
    resultsFeedback: asFeedbackItems(resume.resultsFeedback),
    experienceScore: resume.experienceScore,
    experienceFeedback: asFeedbackItems(resume.experienceFeedback),
    analysisError: resume.analysisError,
  }))

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Resume</h1>
        <PageHeaderBoxes pageKey="resume" candidateId={profile.id} />
      </div>

      <ResumeVersionsList versions={versions} fromGap={fromGap} />

      <ResumeUploadForm narratives={narratives} resumeBookOptIn={profile.resumeBookOptIn} />

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
