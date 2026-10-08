import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import { UnsubscribeForm } from './UnsubscribeForm'

export const metadata: Metadata = { title: 'Unsubscribe — NextChapter', robots: { index: false } }

/**
 * Where the footer link in every list email lands. No sign-in: the token
 * is the proof. Lists the email came from are ticked; one click on
 * Unsubscribe takes them off.
 */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const parsed = readUnsubscribeToken(token)
  const memberships = parsed
    ? await prisma.mailingListMember.findMany({
        where: { email: parsed.email, status: 'ACTIVE', list: { isActive: true } },
        select: { listId: true, list: { select: { name: true, description: true, sortOrder: true } } },
        orderBy: { list: { sortOrder: 'asc' } },
      })
    : []
  const fromEdition = parsed?.editionId
    ? new Set((await prisma.mailingEditionList.findMany({ where: { editionId: parsed.editionId }, select: { listId: true } })).map((l) => l.listId))
    : new Set<string>()

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-foreground">
      <h1 className="text-2xl font-semibold">Unsubscribe</h1>
      {!parsed ? (
        <p className="mt-4 text-sm text-muted-foreground">
          This link is no longer valid. Reply &quot;unsubscribe&quot; to any email from Justin and he&apos;ll take you off.
        </p>
      ) : memberships.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{parsed.email}</span> isn&apos;t on any NextChapter email list. Nothing more will be sent.
        </p>
      ) : (
        <UnsubscribeForm
          token={token}
          email={parsed.email}
          lists={memberships.map((m) => ({ id: m.listId, name: m.list.name, description: m.list.description, checked: fromEdition.size === 0 || fromEdition.has(m.listId) }))}
        />
      )}
    </main>
  )
}
