import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import type { SearchCheckInAnswer } from '@prisma/client'

export const maxDuration = 30

const ANSWER_LABELS: Record<SearchCheckInAnswer, string> = {
  STILL_SEARCHING: 'Still searching',
  TAKING_A_BREAK: 'Taking a break',
  GOT_AN_OFFER: 'Got an offer',
}

function startOfUTCDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function formatUTCDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

interface CheckInRow {
  id: string
  candidateId: string
  name: string
  email: string
  answer: SearchCheckInAnswer | null
  opened: boolean
  sentAt: Date
  respondedAt: Date | null
  tenureDays: number | null
  isMember: boolean
  applicationsCount: number
  outreachCount: number
  referencesCompletedCount: number
}

type SortKey = 'name' | 'answer' | 'opened' | 'tenureDays' | 'applicationsCount' | 'outreachCount' | 'referencesCompletedCount'

function compareRows(a: CheckInRow, b: CheckInRow, sort: SortKey): number {
  switch (sort) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'answer':
      return (a.answer ?? '').localeCompare(b.answer ?? '')
    case 'opened':
      return Number(a.opened) - Number(b.opened)
    case 'tenureDays':
      return (a.tenureDays ?? -1) - (b.tenureDays ?? -1)
    case 'applicationsCount':
      return a.applicationsCount - b.applicationsCount
    case 'outreachCount':
      return a.outreachCount - b.outreachCount
    case 'referencesCompletedCount':
      return a.referencesCompletedCount - b.referencesCompletedCount
  }
}

export default async function SearchCheckInsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; answer?: string; q?: string; sort?: string; dir?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  // Every distinct send-day, newest first — cheap (one column, no joins) —
  // powers the date picker so an admin can look back at any past week's
  // batch, not just the latest.
  const allSentDates = await prisma.candidateSearchCheckIn.findMany({
    select: { sentAt: true },
    orderBy: { sentAt: 'desc' },
  })
  const distinctDays = Array.from(new Set(allSentDates.map((r) => formatUTCDate(r.sentAt)))).sort().reverse()

  if (distinctDays.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Search Check-ins</h1>
        <p className="text-muted-foreground">No &quot;Are you still searching?&quot; emails have gone out yet.</p>
      </div>
    )
  }

  const selectedDay = sp.date && distinctDays.includes(sp.date) ? sp.date : distinctDays[0]
  const dayStart = startOfUTCDay(new Date(`${selectedDay}T00:00:00.000Z`))
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const checkIns = await prisma.candidateSearchCheckIn.findMany({
    where: { sentAt: { gte: dayStart, lt: dayEnd } },
    include: {
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          registrationCompletedAt: true,
        },
      },
    },
  })

  const candidateIds = checkIns.map((c) => c.candidateId)
  const [activeMemberships, applicationCounts, outreachCounts, referenceCounts] = await Promise.all([
    prisma.membershipSubscription.findMany({
      where: { candidateId: { in: candidateIds }, status: 'ACTIVE' },
      select: { candidateId: true },
    }),
    prisma.jobPosting.groupBy({
      by: ['candidateId'],
      where: { candidateId: { in: candidateIds }, appliedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.outreachLog.groupBy({
      by: ['candidateId'],
      where: { candidateId: { in: candidateIds } },
      _count: { _all: true },
    }),
    prisma.reference.groupBy({
      by: ['candidateId'],
      where: { candidateId: { in: candidateIds }, status: 'COMPLETED' },
      _count: { _all: true },
    }),
  ])

  const activeMemberIds = new Set(activeMemberships.map((m) => m.candidateId))
  const applicationsById = new Map(applicationCounts.map((r) => [r.candidateId, r._count._all]))
  const outreachById = new Map(outreachCounts.map((r) => [r.candidateId, r._count._all]))
  const referencesById = new Map(referenceCounts.map((r) => [r.candidateId, r._count._all]))

  const now = new Date()
  let rows: CheckInRow[] = checkIns.map((c) => ({
    id: c.id,
    candidateId: c.candidateId,
    name: [c.candidate.firstName, c.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed',
    email: c.candidate.email ?? '—',
    answer: c.answer,
    opened: !!c.openedAt || !!c.respondedAt, // a real response proves they saw it, even if the tracking pixel was blocked
    sentAt: c.sentAt,
    respondedAt: c.respondedAt,
    tenureDays: c.candidate.registrationCompletedAt
      ? Math.floor((now.getTime() - c.candidate.registrationCompletedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null,
    isMember: activeMemberIds.has(c.candidateId),
    applicationsCount: applicationsById.get(c.candidateId) ?? 0,
    outreachCount: outreachById.get(c.candidateId) ?? 0,
    referencesCompletedCount: referencesById.get(c.candidateId) ?? 0,
  }))

  const q = (sp.q ?? '').trim().toLowerCase()
  if (q) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
  }
  if (sp.answer === 'NO_RESPONSE') {
    rows = rows.filter((r) => r.answer === null)
  } else if (sp.answer) {
    rows = rows.filter((r) => r.answer === sp.answer)
  }

  const sortKey = (sp.sort ?? 'name') as SortKey
  const sortDir = sp.dir === 'desc' ? 'desc' : 'asc'
  rows.sort((a, b) => (sortDir === 'asc' ? compareRows(a, b, sortKey) : compareRows(b, a, sortKey)))

  const answered = rows.filter((r) => r.answer !== null).length
  const opened = rows.filter((r) => r.opened).length

  const columns: AdminColumn<CheckInRow>[] = [
    {
      header: 'Candidate',
      sortKey: 'name',
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.email}</p>
        </div>
      ),
    },
    {
      header: 'Answer',
      sortKey: 'answer',
      render: (r) => (r.answer ? ANSWER_LABELS[r.answer] : <span className="text-muted-foreground">No response</span>),
    },
    { header: 'Opened', sortKey: 'opened', render: (r) => (r.opened ? 'Yes' : 'No') },
    {
      header: 'Responded',
      render: (r) => (r.respondedAt ? r.respondedAt.toISOString().slice(0, 16).replace('T', ' ') : '—'),
    },
    {
      header: 'Searching for',
      sortKey: 'tenureDays',
      render: (r) => (r.tenureDays !== null ? `${r.tenureDays}d` : '—'),
    },
    { header: 'Candidate+', render: (r) => (r.isMember ? 'Yes' : 'No') },
    { header: 'Applications', sortKey: 'applicationsCount', render: (r) => r.applicationsCount },
    { header: 'Networking', sortKey: 'outreachCount', render: (r) => r.outreachCount },
    { header: 'References done', sortKey: 'referencesCompletedCount', render: (r) => r.referencesCompletedCount },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search Check-ins</h1>
        <p className="mt-1 text-muted-foreground">
          Responses to the Saturday &quot;Are you still searching?&quot; email — {answered} of {rows.length} answered,{' '}
          {opened} opened (opens are a floor, not exact — many mail clients block the tracking image).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {distinctDays.slice(0, 12).map((day) => (
          <a
            key={day}
            href={`/support/admin/search-checkins?date=${day}`}
            className={
              day === selectedDay
                ? 'rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted'
            }
          >
            {day}
          </a>
        ))}
      </div>

      <AdminFilterBar
        basePath="/support/admin/search-checkins"
        searchValue={sp.q ?? ''}
        searchPlaceholder="Search name or email…"
        filters={[
          {
            key: 'answer',
            label: 'Answer',
            value: sp.answer ?? '',
            options: [
              { value: 'STILL_SEARCHING', label: 'Still searching' },
              { value: 'TAKING_A_BREAK', label: 'Taking a break' },
              { value: 'GOT_AN_OFFER', label: 'Got an offer' },
              { value: 'NO_RESPONSE', label: 'No response' },
            ],
          },
        ]}
      />

      <AdminDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No check-ins match this filter."
        sorting={{
          currentKey: sortKey,
          currentDir: sortDir,
          basePath: '/support/admin/search-checkins',
          baseParams: { date: selectedDay, ...(sp.q ? { q: sp.q } : {}), ...(sp.answer ? { answer: sp.answer } : {}) },
        }}
      />
    </div>
  )
}
