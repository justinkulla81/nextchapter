import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CONTACT_AUDIENCE_SHORT } from '@/lib/contact/constants'
import { ContactHandledButton } from '@/components/admin/ContactHandledButton'

function stamp(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
}

/** Messages from the public /contact form, newest first. Open ones on top. */
export default async function ContactMessagesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin()
  const { show } = await searchParams
  const showAll = show === 'all'
  const rows = await prisma.contactSubmission.findMany({
    where: showAll ? {} : { handledAt: null },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm/home" className="text-muted-foreground hover:underline">← Ecosystem</Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold">Contact messages</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Sent through launchyournextchapter.com/contact. Each one is also emailed to you and filed in the CRM under the sender.
        </p>
      </header>

      <div className="flex gap-2 text-sm">
        <Link href="/support/admin/crm/contact-messages" aria-current={!showAll} className={`rounded-full border px-3 py-1 ${!showAll ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-border hover:bg-muted'}`}>Open</Link>
        <Link href="/support/admin/crm/contact-messages?show=all" aria-current={showAll} className={`rounded-full border px-3 py-1 ${showAll ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-border hover:bg-muted'}`}>All</Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {showAll ? 'No messages yet.' : 'No open messages.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold">{r.fullName}</span>
                  <span className="select-all text-muted-foreground">{r.email}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{CONTACT_AUDIENCE_SHORT[r.audience]}</span>
                  {r.source === 'why-stuck' && <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">Job search question</span>}
                  {r.organization && <span className="text-muted-foreground">{r.organization}{r.role ? ` · ${r.role}` : ''}</span>}
                  {!r.organization && r.role && <span className="text-muted-foreground">{r.audience === 'JOB_APPLICANT' ? `Interested in: ${r.role}` : r.role}</span>}
                  {r.linkedinUrl && <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand underline">LinkedIn</a>}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {stamp(r.createdAt)}
                  {r.emailedAt ? ' · emailed' : ' · email not sent'}
                  {r.crmPersonId && <> · <Link href={`/support/admin/crm/people/${r.crmPersonId}`} className="underline">CRM record</Link></>}
                  {r.handledAt && ` · handled ${stamp(r.handledAt)}`}
                </p>
              </div>
              <ContactHandledButton id={r.id} handled={!!r.handledAt} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
