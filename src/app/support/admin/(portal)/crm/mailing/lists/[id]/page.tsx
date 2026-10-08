import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CADENCE_LABEL } from '@/lib/mailing/cadence'
import { SubmitButton } from '@/components/ui/submit-button'
import { ListMemberAdd } from '@/components/admin/mailing/ListMemberAdd'
import { removeListMember } from '../../actions'

const STATUS_LABEL = { UNSUBSCRIBED: 'Unsubscribed', BOUNCED: 'Bounced', COMPLAINED: 'Marked as spam' } as const

/**
 * One list's default readership: who every send to it starts from. Changes
 * here stick; for one send only, add or remove people on that edition.
 */
export default async function ListReadershipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const list = await prisma.mailingList.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: [{ status: 'asc' }, { email: 'asc' }],
        include: {
          person: {
            select: {
              id: true, fullName: true,
              affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } },
            },
          },
        },
      },
    },
  })
  if (!list) notFound()
  const active = list.members.filter((m) => m.status === 'ACTIVE')
  const gone = list.members.filter((m) => m.status !== 'ACTIVE')

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/support/admin/crm/mailing/lists" className="text-sm text-muted-foreground hover:underline">← Lists and sender settings</Link>
        <h1 className="text-2xl font-semibold">{list.name}</h1>
        <p className="text-sm text-muted-foreground">
          {CADENCE_LABEL[list.cadence]} · {active.length.toLocaleString()} {active.length === 1 ? 'person' : 'people'} on the default readership
          {list.audience ? ` · ${list.audience}` : ''}
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every send to this list starts from these people. To include or leave out someone for one send only, do it on that send&apos;s page — this list stays as it is.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Add someone</h2>
        <ListMemberAdd listId={list.id} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Default readership ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is on this list yet. Add someone above, or answer the &ldquo;Add to a list?&rdquo; cards.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {active.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  {m.person ? <Link href={`/support/admin/crm/people/${m.person.id}`} className="font-medium hover:underline">{m.person.fullName}</Link> : <span className="font-medium">{m.email}</span>}
                  {m.person?.affiliations[0] && <span className="text-muted-foreground"> · {m.person.affiliations[0].org.name}</span>}
                  {m.person && <span className="block text-xs text-muted-foreground">{m.email}</span>}
                </span>
                <span className="text-xs text-muted-foreground">Added {m.addedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <form action={removeListMember.bind(null, m.id)}>
                  <SubmitButton size="sm" variant="ghost" pendingLabel="Removing…">Remove from list</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {gone.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Not mailed ({gone.length})</h2>
          <p className="text-xs text-muted-foreground">Kept on record so an import or signup can&apos;t quietly add them back.</p>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {gone.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-muted-foreground">
                <span className="flex-1">{m.person?.fullName ?? m.email}</span>
                <span className="text-xs">{STATUS_LABEL[m.status as keyof typeof STATUS_LABEL]}{m.statusAt ? ` ${m.statusAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
