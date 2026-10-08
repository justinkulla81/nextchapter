import { prisma } from '@/lib/prisma'
import { activeLists, suggestionsFor } from '@/lib/mailing/lists'
import { PersonMailingPanel } from './PersonMailingPanel'
import { DoNotEmailToggle } from './DoNotEmailToggle'
import { doNotEmailPeople } from '@/lib/mailing/lists'

/** The person page's "Mailing lists and reports" section; loads its own data. */
export async function PersonMailingSection({ personId, email }: { personId: string; email: string | null }) {
  const e = email?.toLowerCase() ?? null
  const [memberships, lists, suggestions, sends, editions, suppression, emails] = await Promise.all([
    prisma.mailingListMember.findMany({
      where: { OR: [{ personId }, ...(e ? [{ email: e }] : [])] },
      include: { list: { select: { name: true, sortOrder: true } } },
      orderBy: { list: { sortOrder: 'asc' } },
    }),
    activeLists(),
    suggestionsFor([personId]),
    prisma.crmReportSend.findMany({ where: { personId }, orderBy: { editionKey: 'desc' } }),
    prisma.mailingEdition.findMany({ where: { isReport: true, reportKey: { not: null } }, select: { reportKey: true }, distinct: ['reportKey'], orderBy: { reportKey: 'desc' }, take: 12 }),
    e ? prisma.mailingSuppression.findUnique({ where: { email: e } }) : null,
    prisma.mailingEditionRecipient.findMany({
      where: { status: { in: ['SENT', 'FAILED'] }, OR: [{ personId }, ...(e ? [{ email: e }] : [])] },
      include: { edition: { select: { id: true, title: true, subject: true } } },
      orderBy: { sentAt: 'desc' },
    }),
  ])
  // One row per list: an address can only be on a list once, but the person
  // link and the address can each match a row.
  const byList = new Map(memberships.map((m) => [m.listId, m]))
  const now = new Date()
  const recentKeys = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const reportKeys = [...new Set([...editions.map((x) => x.reportKey!), ...recentKeys])].sort().reverse()

  const doNotEmail = (await doNotEmailPeople()).personIds.has(personId)

  return (
    <div className="space-y-4">
    <DoNotEmailToggle personId={personId} on={doNotEmail} hasEmail={!!e} />
    <PersonMailingPanel
      personId={personId}
      hasEmail={!!e}
      memberships={[...byList.values()].map((m) => ({
        listId: m.listId, listName: m.list.name, status: m.status, addedVia: m.addedVia, addedAt: m.addedAt.toISOString(), consentNote: m.consentNote,
      }))}
      lists={lists.map((l) => ({ id: l.id, key: l.key, name: l.name, audience: l.audience }))}
      suggested={suggestions.get(personId) ?? ['monthly_update']}
      reportSends={sends.map((s) => ({
        editionKey: s.editionKey, method: s.method, channel: s.channel, sentAt: s.sentAt.toISOString(),
        openedAt: s.openedAt?.toISOString() ?? null, clickedAt: s.clickedAt?.toISOString() ?? null, repliedAt: s.repliedAt?.toISOString() ?? null,
      }))}
      reportKeys={reportKeys}
      suppressed={suppression?.reason ?? null}
      listEmails={emails.map((r) => ({
        id: r.id, editionId: r.edition.id, title: r.edition.title, subject: r.edition.subject, email: r.email, failed: r.status === 'FAILED',
        sentAt: r.sentAt?.toISOString() ?? null, deliveredAt: r.deliveredAt?.toISOString() ?? null,
        openCount: r.openCount, clickCount: r.clickCount, repliedAt: r.repliedAt?.toISOString() ?? null,
        bouncedAt: r.bouncedAt?.toISOString() ?? null, unsubscribedAt: r.unsubscribedAt?.toISOString() ?? null,
      }))}
    />
    </div>
  )
}
