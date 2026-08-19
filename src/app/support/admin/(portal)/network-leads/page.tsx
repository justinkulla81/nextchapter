import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { ContactOutreachStatusForm } from '@/components/admin/ContactOutreachStatusForm'
import { updateContactAdminNotes, removeLeadTag } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import type { ContactAdminOutreachStatus, RelationshipTag } from '@prisma/client'

export const maxDuration = 30

interface Row {
  id: string
  tag: RelationshipTag
  name: string
  email: string | null
  company: string | null
  candidateName: string
  candidateEmail: string
  source: string
  addedAt: Date
  outreachStatus: ContactAdminOutreachStatus
  notes: string | null
}

// Contacts candidates have flagged (manually or via Gmail/Calendar
// auto-detection) as a recruiter, coach, or hiring manager — a
// business-development lead list for NextChapter's own outreach, entirely
// separate from the candidate's own relationship to that person.
const LEAD_TAGS: { tag: RelationshipTag; title: string; description: string }[] = [
  {
    tag: 'RECRUITER',
    title: 'Recruiters',
    description: 'People candidates have flagged as recruiters — potential Recruiter Database partners.',
  },
  {
    tag: 'COACH',
    title: 'Coaches',
    description: 'People candidates have flagged as career/executive coaches — potential Coach partners.',
  },
  {
    tag: 'HIRING_MANAGER',
    title: 'Hiring Managers',
    description: 'People candidates have flagged as hiring managers — potential Talent/employer contacts.',
  },
]

export default async function NetworkLeadsAdminPage() {
  await requireAdmin()

  const [contacts, authUsers] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { relationshipTags: { hasSome: LEAD_TAGS.map((t) => t.tag) } },
      include: { candidate: { select: { firstName: true, lastName: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    listAllAuthUsers(),
  ])

  const rowsByTag: Partial<Record<RelationshipTag, Row[]>> = { RECRUITER: [], COACH: [], HIRING_MANAGER: [] }
  for (const c of contacts) {
    for (const { tag } of LEAD_TAGS) {
      if (!c.relationshipTags.includes(tag)) continue
      rowsByTag[tag]!.push({
        id: c.id,
        tag,
        name: c.name,
        email: c.email,
        company: c.company ?? c.inferredCompany,
        candidateName: [c.candidate.firstName, c.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed',
        candidateEmail: getAuthEmail(authUsers, c.candidate.userId),
        source: c.source,
        addedAt: c.createdAt,
        outreachStatus: c.adminOutreachStatus,
        notes: c.adminNotes,
      })
    }
  }

  const columns: AdminColumn<Row>[] = [
    { header: 'Name', render: (r) => r.name },
    { header: 'Email', render: (r) => r.email ?? '—' },
    { header: 'Company', render: (r) => r.company ?? '—' },
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
    { header: 'Added', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.addedAt.toLocaleDateString() },
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
      ),
    },
  ]

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

      {LEAD_TAGS.map(({ tag, title, description }) => {
        const rows = rowsByTag[tag]!
        return (
          <div key={tag} className="space-y-2">
            <div>
              <h2 className="text-lg font-semibold">
                {title} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
              </h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <AdminDataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              emptyMessage={`No ${title.toLowerCase()} flagged yet.`}
            />
          </div>
        )
      })}
    </div>
  )
}
