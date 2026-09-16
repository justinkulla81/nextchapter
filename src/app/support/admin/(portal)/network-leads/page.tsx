import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { AdminDataTable, type AdminColumn, type AdminSortInfo } from '@/components/admin/AdminDataTable'
import { ContactOutreachStatusForm } from '@/components/admin/ContactOutreachStatusForm'
import { NetworkLeadTagsSelect } from '@/components/admin/NetworkLeadTagsSelect'
import { NetworkLeadPrioritySelect } from '@/components/admin/NetworkLeadPrioritySelect'
import { updateContactAdminNotes, removeLeadTag, dismissNetworkLead } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import type { ContactAdminOutreachStatus, RelationshipTag, CrmPriorityTier } from '@prisma/client'

export const maxDuration = 30

interface Row {
  id: string
  tag: RelationshipTag
  allTags: RelationshipTag[]
  name: string
  email: string | null
  company: string | null
  candidateName: string
  candidateEmail: string
  source: string
  addedAt: Date
  outreachStatus: ContactAdminOutreachStatus
  notes: string | null
  priority: CrmPriorityTier | null
  linkHref: string | null
}

// Contacts candidates have flagged (manually or via Gmail/Calendar
// auto-detection) as a recruiter, coach, or hiring manager — a
// business-development lead list for NextChapter's own outreach, entirely
// separate from the candidate's own relationship to that person.
const LEAD_TAGS: { tag: RelationshipTag; title: string; description: string; sortPrefix: string }[] = [
  {
    tag: 'RECRUITER',
    title: 'Recruiters',
    description: 'People candidates have flagged as recruiters — potential Recruiter Database partners.',
    sortPrefix: 'r',
  },
  {
    tag: 'COACH',
    title: 'Coaches',
    description: 'People candidates have flagged as career/executive coaches — potential Coach partners.',
    sortPrefix: 'c',
  },
  {
    tag: 'HIRING_MANAGER',
    title: 'Hiring Managers',
    description: 'People candidates have flagged as hiring managers — potential Talent/employer contacts.',
    sortPrefix: 'h',
  },
]

const SORT_KEYS = ['name', 'company', 'added', 'priority'] as const
type SortKey = (typeof SORT_KEYS)[number]

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 }

function sortRows(rows: Row[], key: SortKey, dir: 'asc' | 'desc'): Row[] {
  const sorted = [...rows].sort((a, b) => {
    if (key === 'name') return a.name.localeCompare(b.name)
    if (key === 'company') return (a.company ?? '').localeCompare(b.company ?? '')
    if (key === 'priority') return (PRIORITY_RANK[a.priority ?? ''] ?? 3) - (PRIORITY_RANK[b.priority ?? ''] ?? 3)
    return a.addedAt.getTime() - b.addedAt.getTime()
  })
  return dir === 'desc' ? sorted.reverse() : sorted
}

export default async function NetworkLeadsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams

  const [contacts, authUsers, recruiters, coaches] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { relationshipTags: { hasSome: LEAD_TAGS.map((t) => t.tag) }, leadDismissedAt: null },
      include: { candidate: { select: { firstName: true, lastName: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    listAllAuthUsers(),
    prisma.recruiter.findMany({ select: { id: true, workEmail: true } }),
    prisma.coach.findMany({ select: { id: true, workEmail: true } }),
  ])

  const recruiterByEmail = new Map(recruiters.filter((r) => r.workEmail).map((r) => [r.workEmail!.toLowerCase(), r.id]))
  const coachByEmail = new Map(coaches.filter((c) => c.workEmail).map((c) => [c.workEmail!.toLowerCase(), c.id]))
  function linkFor(email: string | null): string | null {
    if (!email) return null
    const lower = email.toLowerCase()
    const recruiterId = recruiterByEmail.get(lower)
    if (recruiterId) return `/support/admin/recruiters/${recruiterId}`
    const coachId = coachByEmail.get(lower)
    if (coachId) return `/support/admin/coaches/${coachId}`
    return null
  }

  const rowsByTag: Partial<Record<RelationshipTag, Row[]>> = { RECRUITER: [], COACH: [], HIRING_MANAGER: [] }
  for (const c of contacts) {
    for (const { tag } of LEAD_TAGS) {
      if (!c.relationshipTags.includes(tag)) continue
      rowsByTag[tag]!.push({
        id: c.id,
        tag,
        allTags: c.relationshipTags,
        name: c.name,
        email: c.email,
        company: c.company ?? c.inferredCompany,
        candidateName: [c.candidate.firstName, c.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed',
        candidateEmail: getAuthEmail(authUsers, c.candidate.userId),
        source: c.source,
        addedAt: c.createdAt,
        outreachStatus: c.adminOutreachStatus,
        notes: c.adminNotes,
        priority: c.adminPriority,
        linkHref: linkFor(c.email),
      })
    }
  }

  function columnsFor(): AdminColumn<Row>[] {
    return [
      {
        header: 'Name', sortKey: 'name',
        render: (r) => (r.linkHref ? <Link href={r.linkHref} className="text-primary underline underline-offset-4">{r.name}</Link> : r.name),
      },
      { header: 'Email', render: (r) => r.email ?? '—' },
      { header: 'Company', sortKey: 'company', render: (r) => r.company ?? '—' },
      { header: 'Role', render: (r) => <NetworkLeadTagsSelect contactId={r.id} tags={r.allTags} name={r.name} /> },
      { header: 'Priority', sortKey: 'priority', render: (r) => <NetworkLeadPrioritySelect contactId={r.id} value={r.priority} /> },
      {
        header: 'Flagged by',
        render: (r) => (
          <div>
            <div>{r.candidateName}</div>
            <div className="text-xs text-muted-foreground">{r.candidateEmail}</div>
          </div>
        ),
      },
      { header: 'Source', render: (r) => r.source },
      { header: 'Added', sortKey: 'added', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.addedAt.toLocaleDateString() },
      {
        header: 'Notes',
        render: (r) => (
          <form action={updateContactAdminNotes.bind(null, r.id)} className="flex items-center gap-1.5">
            <input
              type="text"
              name="notes"
              defaultValue={r.notes ?? ''}
              placeholder="Add a note…"
              className="h-8 w-40 rounded-md border border-input bg-transparent px-2 text-xs"
            />
            <SubmitButton variant="ghost" size="sm" className="h-8 px-2 text-xs">
              Save
            </SubmitButton>
          </form>
        ),
      },
      {
        header: 'Outreach status',
        render: (r) => <ContactOutreachStatusForm contactId={r.id} status={r.outreachStatus} />,
      },
      {
        header: '',
        render: (r) => (
          <div className="flex items-center gap-1">
            <form action={removeLeadTag.bind(null, r.id, r.tag)}>
              <SubmitButton
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                title="Not actually a recruiter/coach/hiring manager — remove from this list"
              >
                Remove
              </SubmitButton>
            </form>
            <form action={dismissNetworkLead.bind(null, r.id)}>
              <SubmitButton
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                title="Dismiss — hides from every lead list, doesn't change their role"
              >
                ✕
              </SubmitButton>
            </form>
          </div>
        ),
      },
    ]
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Network Leads</h1>
        <p className="mt-1 text-muted-foreground">
          Recruiters, coaches, and hiring managers candidates have flagged in their own networks — a
          business-development lead list, not a place candidates see. Use the outreach status to track who
          NextChapter has followed up with.
        </p>
      </div>

      {LEAD_TAGS.map(({ tag, title, description, sortPrefix }) => {
        const rows = rowsByTag[tag]!
        const sortParam = `${sortPrefix}Sort`
        const dirParam = `${sortPrefix}Dir`
        const currentKey = SORT_KEYS.includes(sp[sortParam] as SortKey) ? (sp[sortParam] as SortKey) : 'added'
        const currentDir = sp[dirParam] === 'asc' ? 'asc' : 'desc'
        // Every OTHER section's sort state is preserved verbatim in baseParams
        // so clicking a header in one table never resets another's.
        const baseParams = Object.fromEntries(
          Object.entries(sp).filter(([k, v]) => v !== undefined && k !== sortParam && k !== dirParam)
        ) as Record<string, string>
        const sorting: AdminSortInfo = {
          currentKey, currentDir, basePath: '/support/admin/network-leads', baseParams, sortParam, dirParam,
        }
        const sortedRows = sortRows(rows, currentKey, currentDir)

        return (
          <div key={tag} className="space-y-2">
            <div>
              <h2 className="text-lg font-semibold">
                {title} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
              </h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <AdminDataTable
              columns={columnsFor()}
              rows={sortedRows}
              rowKey={(r) => r.id}
              emptyMessage={`No ${title.toLowerCase()} flagged yet.`}
              sorting={sorting}
            />
          </div>
        )
      })}
    </div>
  )
}
