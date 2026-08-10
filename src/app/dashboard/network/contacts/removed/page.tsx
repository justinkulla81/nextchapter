import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { restoreContact } from '@/app/dashboard/network/actions'
import { SubmitButton } from '@/components/ui/submit-button'

export const metadata: Metadata = { title: 'Removed Contacts' }

export default async function RemovedContactsPage() {
  const profile = await getDashboardData()
  const contacts = await prisma.supportNetworkContact.findMany({
    where: { candidateId: profile.id, removedAt: { not: null } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, company: true, linkedinUrl: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/network/contacts"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          ← Back to Contact Directory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Removed Contacts</h1>
        <p className="mt-1 text-muted-foreground">
          People you&apos;ve removed from your Contact Directory. Restoring someone here puts them
          back on the main list — and re-uploading a LinkedIn export never brings them back on its
          own.
        </p>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody&apos;s been removed.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {contact.linkedinUrl ? (
                      <a
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {contact.name}
                      </a>
                    ) : (
                      contact.name
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{contact.company ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <form action={restoreContact.bind(null, contact.id)}>
                      <SubmitButton size="sm" variant="outline">
                        Restore
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
