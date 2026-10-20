import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import type { ResumeVersionItem } from '@/components/dashboard/ResumeVersionsList'
import { getResumeFixes } from '@/lib/reports/market-reality-sections'
import { ResumeRedesign } from '@/components/dashboard/ResumeRedesign'
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

  return <ResumeRedesign versions={versions} fixes={resumeFixes?.items ?? []} narratives={narratives} resumeBookOptIn={profile.resumeBookOptIn} fromGap={fromGap} />
}
