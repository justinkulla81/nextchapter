import Link from 'next/link'
import type { Prisma, CurrentJobStatus, SearchIntensity } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { EXCLUDE_SYSTEM_ACCOUNT } from '@/lib/admin/system-account-filter'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'

export const maxDuration = 30

const INTENSITY_LABEL: Record<string, string> = {
  ACTIVELY_SEARCHING: 'Actively searching',
  CASUALLY_LOOKING: 'Casually looking',
  EXPLORING: 'Exploring',
  OPEN: 'Open',
}
const LEVEL_OPTIONS = ['IC', 'Manager', 'Director', 'VP', 'C-Suite']

interface Row {
  id: string
  name: string
  email: string
  statusLabel: string | null
  intensityLabel: string | null
  primaryFunction: string | null
  level: string | null
  grade: string | null
  optedIn: boolean
  signupIp: string | null
  signedUpAt: Date
  location: string | null
  resumeSignedUrl: string | null
}

// One signed URL per candidate's latest resume, generated in parallel —
// same pattern as the candidate detail page's own loadIpAndResume, scaled
// to a page of rows instead of one candidate. Only fetched for the current
// page (25 rows), not the full 85-candidate table.
async function loadResumeLinks(candidateIds: string[]): Promise<Map<string, string>> {
  if (candidateIds.length === 0) return new Map()
  const admin = createAdminClient()
  const entries = await Promise.all(
    candidateIds.map(async (candidateId) => {
      const resume = await prisma.resume.findFirst({ where: { candidateId }, orderBy: { uploadedAt: 'desc' } })
      if (!resume) return null
      const { data } = await admin.storage.from('resumes').createSignedUrl(resume.filePath, 60 * 10)
      return data?.signedUrl ? ([candidateId, data.signedUrl] as const) : null
    })
  )
  return new Map(entries.filter((e): e is readonly [string, string] => e !== null))
}

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, ['status', 'intensity', 'level', 'optedIn'], 25)

  const where: Prisma.CandidateProfileWhereInput = {
    ...EXCLUDE_SYSTEM_ACCOUNT,
    ...(params.filters.status && { currentJobStatus: params.filters.status as CurrentJobStatus }),
    ...(params.filters.intensity && { searchIntensity: params.filters.intensity as SearchIntensity }),
    ...(params.filters.level && { highestLevelReached: params.filters.level }),
    ...(params.filters.optedIn === 'yes' && { recruiterDatabaseOptIn: true }),
    ...(params.filters.optedIn === 'no' && { recruiterDatabaseOptIn: false }),
    ...(params.q && {
      OR: [
        { firstName: { contains: params.q, mode: 'insensitive' } },
        { lastName: { contains: params.q, mode: 'insensitive' } },
      ],
    }),
  }

  const [candidates, total, authUsers] = await Promise.all([
    prisma.candidateProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        currentJobStatus: true,
        searchIntensity: true,
        primaryFunction: true,
        highestLevelReached: true,
        recruiterDatabaseOptIn: true,
        signupIp: true,
        createdAt: true,
        currentCity: true,
        currentState: true,
        // MarketRealitySnapshot (weekly, guaranteed cadence) rather than
        // MarketRealityReport — a report only generates on specific triggers.
        marketRealitySnapshots: {
          orderBy: { weekStartDate: 'desc' },
          take: 1,
          select: { grade: true },
        },
      },
    }),
    prisma.candidateProfile.count({ where }),
    listAllAuthUsers(),
  ])

  const resumeLinksByCandidateId = await loadResumeLinks(candidates.map((c) => c.id))

  const rows: Row[] = candidates.map((c) => {
    const grade = c.marketRealitySnapshots[0]?.grade ?? null
    return {
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
      email: getAuthEmail(authUsers, c.userId),
      statusLabel: c.currentJobStatus ? CURRENT_JOB_STATUS_LABELS[c.currentJobStatus] : null,
      intensityLabel: c.searchIntensity ? INTENSITY_LABEL[c.searchIntensity] : null,
      primaryFunction: c.primaryFunction,
      level: c.highestLevelReached,
      grade,
      optedIn: c.recruiterDatabaseOptIn,
      signupIp: c.signupIp,
      location: [c.currentCity, c.currentState].filter(Boolean).join(', ') || null,
      resumeSignedUrl: resumeLinksByCandidateId.get(c.id) ?? null,
      signedUpAt: c.createdAt,
    }
  })

  const result = paginatedResult(rows, total, params)

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Name',
      render: (r) => (
        <Link href={`/support/admin/candidates/${r.id}`} className="text-primary underline underline-offset-4">
          {r.name}
        </Link>
      ),
    },
    { header: 'Email', render: (r) => r.email },
    { header: 'Location', render: (r) => r.location ?? '—' },
    {
      header: 'Resume',
      render: (r) =>
        r.resumeSignedUrl ? (
          <a href={r.resumeSignedUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
            View
          </a>
        ) : (
          '—'
        ),
    },
    { header: 'Status', render: (r) => r.statusLabel ?? '—' },
    { header: 'Search intensity', render: (r) => r.intensityLabel ?? '—' },
    { header: 'Function', render: (r) => r.primaryFunction ?? '—' },
    { header: 'Level', render: (r) => r.level ?? '—' },
    { header: 'Grade', render: (r) => r.grade ?? 'Not graded' },
    { header: 'Recruiter opt-in', render: (r) => (r.optedIn ? 'Yes' : 'No') },
    { header: 'Signup IP', render: (r) => r.signupIp ?? '—' },
    { header: 'Date signed up', render: (r) => r.signedUpAt.toLocaleDateString() },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
        <p className="mt-1 text-muted-foreground">{total} total — filter by segment or search by name.</p>
      </div>

      <AdminFilterBar
        basePath="/support/admin/candidates"
        searchValue={rawParams.q ?? ''}
        searchPlaceholder="Search by name…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: params.filters.status ?? '',
            options: Object.entries(CURRENT_JOB_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'intensity',
            label: 'Search intensity',
            value: params.filters.intensity ?? '',
            options: Object.entries(INTENSITY_LABEL).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'level',
            label: 'Level',
            value: params.filters.level ?? '',
            options: LEVEL_OPTIONS.map((v) => ({ value: v, label: v })),
          },
          {
            key: 'optedIn',
            label: 'Recruiter opt-in',
            value: params.filters.optedIn ?? '',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          },
        ]}
      />

      <AdminDataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        emptyMessage="No candidates match."
        pagination={{
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          basePath: '/support/admin/candidates',
          baseParams: { q: params.q, ...params.filters },
        }}
      />
    </div>
  )
}
