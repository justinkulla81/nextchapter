import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { parseListParams, paginatedResult } from '@/lib/admin/pagination'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { TesterCheckbox } from '@/components/admin/TesterCheckbox'
import { addManualTesterEmail, removeManualTesterEmail } from './actions'

interface Row {
  id: string
  name: string
  email: string | null
  enabled: boolean
}

// Admin-managed Gmail/Calendar tracking allow-list — replaces manually
// editing GMAIL_TRACKING_TESTER_EMAILS in Vercel (which required a redeploy
// and had no per-candidate visibility) with a checkbox per candidate plus a
// free-text add for emails not tied to any CandidateProfile (an admin's own
// test inbox, etc). See isGmailTrackingTester() in
// src/lib/email-tracking/gmail-oauth.ts for how all three sources combine.
export default async function TrackingTestersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const params = parseListParams(rawParams, [], 25)

  const where: Prisma.CandidateProfileWhereInput = {
    ...(params.q && {
      OR: [
        { firstName: { contains: params.q, mode: 'insensitive' } },
        { lastName: { contains: params.q, mode: 'insensitive' } },
        { email: { contains: params.q, mode: 'insensitive' } },
      ],
    }),
  }

  const [candidates, total, manualEntries] = await Promise.all([
    prisma.candidateProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: { id: true, firstName: true, lastName: true, email: true, gmailTrackingTesterEnabled: true },
    }),
    prisma.candidateProfile.count({ where }),
    prisma.trackingTesterAllowlistEntry.findMany({ orderBy: { createdAt: 'desc' } }),
  ])

  const rows: Row[] = candidates.map((c) => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
    email: c.email,
    enabled: c.gmailTrackingTesterEnabled,
  }))
  const result = paginatedResult(rows, total, params)

  const columns: AdminColumn<Row>[] = [
    { header: 'Name', render: (r) => r.name },
    { header: 'Email', render: (r) => r.email ?? '—' },
    {
      header: 'Gmail/Calendar tester',
      render: (r) => <TesterCheckbox candidateId={r.id} enabled={r.enabled} />,
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gmail/Calendar Testers</h1>
        <p className="mt-1 text-muted-foreground">
          Internal-testing allow-list for the candidate-facing Gmail + Calendar connect feature — no
          candidate outside this list can reach Google&apos;s consent screen. Toggle any candidate below,
          or add an email directly for one not tied to a candidate profile.
        </p>
      </div>

      <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 text-sm text-foreground">
        <p className="font-medium">Pro tip: enabling here isn&apos;t enough on its own.</p>
        <p className="mt-1 text-muted-foreground">
          Our Google OAuth app is still in Testing mode, so Google will also block the consent screen
          for anyone not added as a test user there — separately from this allow-list. After enabling a
          candidate below, add their email as a test user too.
        </p>
        <a
          href="https://console.cloud.google.com/apis/credentials/consent"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-medium text-brand underline underline-offset-4"
        >
          Add test users in Google Cloud Console →
        </a>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Manually added emails</h2>
        <form action={addManualTesterEmail} className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="name@example.com"
            className="h-9 min-w-56 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
          <button
            type="submit"
            className="h-9 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
          >
            Add
          </button>
        </form>
        {manualEntries.length > 0 ? (
          <ul className="space-y-1.5">
            {manualEntries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">{entry.email}</span>
                <form action={removeManualTesterEmail.bind(null, entry.email)}>
                  <button type="submit" className="text-xs text-muted-foreground underline hover:text-destructive">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No manually added emails yet.</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Candidates</h2>
        <AdminFilterBar
          basePath="/support/admin/tracking-testers"
          searchValue={rawParams.q ?? ''}
          searchPlaceholder="Search by name or email…"
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
            basePath: '/support/admin/tracking-testers',
            baseParams: { q: params.q },
          }}
        />
      </div>
    </div>
  )
}
