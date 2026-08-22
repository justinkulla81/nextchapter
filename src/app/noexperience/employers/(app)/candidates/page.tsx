import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { CRUCIBLE_BAND_LABEL, CRUCIBLE_VARIANTS, type CrucibleVariantKey } from '@/lib/crucible/variants'
import { mapFunctionInterestToJobIntent } from '@/lib/crucible/employers/function-interest'
import { CandidateResumeDownloadButton } from '@/components/crucible/employers/CandidateResumeDownloadButton'
import { CandidateFunctionFilter } from '@/components/crucible/employers/CandidateFunctionFilter'
import type { CrucibleFunctionInterest } from '@prisma/client'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — Candidates' },
  robots: { index: false, follow: false },
}

interface Row {
  id: string
  score: number | null
  jobIntent: string | null
  variant: string | null
  aiTools: unknown
  resumeFileName: string | null
}

// Candidate-side intent labels (matches CrucibleTestFlow's JOB_INTENT_OPTIONS
// wording) — kept as a small local map rather than a shared export since
// this is the only employer-facing spot that needs it.
const JOB_INTENT_LABEL: Record<string, string> = {
  TECH: 'Tech / Software',
  MARKETING: 'Marketing / Content',
  DATA: 'Data / Analytics',
  DESIGN: 'Design / Creative',
  BUSINESS: 'Business / Ops',
  UNSURE: 'Not sure yet',
}

// The whole free-tier pitch is full visibility, no teaser/locked tier — the
// gate is exactly branch=PASS AND resumeFilePath present AND
// resumeShareConsent=true, nothing else. Never selects or renders the
// candidate's raw email anywhere on this page.
export default async function CrucibleEmployerCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const rawParams = await searchParams
  const params = parseListParams(rawParams, ['function'], 25)
  const functionFilter = params.filters.function as CrucibleFunctionInterest | undefined

  const where = {
    branch: 'PASS' as const,
    resumeFilePath: { not: null },
    resumeShareConsent: true,
    ...(functionFilter ? { jobIntent: mapFunctionInterestToJobIntent(functionFilter) } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.crucibleSession.findMany({
      where,
      orderBy: { score: 'desc' },
      skip: params.skip,
      take: params.take,
      select: { id: true, score: true, jobIntent: true, variant: true, aiTools: true, resumeFileName: true },
    }),
    prisma.crucibleSession.count({ where }),
  ])

  const result = paginatedResult(rows as Row[], total, params)

  const columns: AdminColumn<Row>[] = [
    { header: 'Score', className: 'px-3 py-2 tabular-nums', render: (r) => (r.score != null ? `${r.score}/100` : '—') },
    { header: 'Result', render: (r) => (r.score != null ? CRUCIBLE_BAND_LABEL(r.score) : '—') },
    {
      header: 'Track',
      render: (r) => (r.variant ? (CRUCIBLE_VARIANTS[r.variant as CrucibleVariantKey]?.label ?? r.variant) : '—'),
    },
    { header: 'Hiring for', render: (r) => (r.jobIntent ? (JOB_INTENT_LABEL[r.jobIntent] ?? r.jobIntent) : '—') },
    {
      header: 'AI tools used',
      render: (r) => {
        const tools = (r.aiTools as { tools?: string[] } | null)?.tools
        return tools && tools.length > 0 ? tools.join(', ') : '—'
      },
    },
    {
      header: 'Resume',
      render: (r) => <CandidateResumeDownloadButton sessionId={r.id} />,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="mt-1 text-muted-foreground">
            {total} candidate{total === 1 ? '' : 's'} passed the assessment and chose to share their resume.
          </p>
        </div>
        <CandidateFunctionFilter current={functionFilter ?? 'ALL'} />
      </div>

      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        emptyMessage="No candidates match this filter yet — check back soon or try a different function."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/noexperience/employers/candidates',
          baseParams: functionFilter ? { function: functionFilter } : {},
        }}
      />
    </div>
  )
}
