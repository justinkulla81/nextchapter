import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * A click on a Write email button in a layoff alert, kept on the contact's CRM record so the timeline shows the draft was
 * opened (the send itself is logged later by the Gmail sync). One note per person per layoff however many times it is clicked.
 * Only for a contact that is a CRM person; a job center or office has no record to write to. Never throws.
 */
export async function recordComposeClick(c: { group: string; variant: string | null; personId: string | null; noticeId: string }): Promise<void> {
  if (!c.personId) return
  try {
    const sourceRef = `compose:${c.noticeId}:${c.personId}`
    if (await prisma.crmActivity.findFirst({ where: { personId: c.personId, sourceRef }, select: { id: true } })) return
    const noticeId = c.noticeId.replace(/^test:/, '')
    const notice = await prisma.warnNotice.findUnique({ where: { id: noticeId }, select: { employer: true, promotedOrgId: true } }).catch(() => null)
    await prisma.crmActivity.create({
      data: {
        type: 'NOTE', direction: 'INTERNAL', personId: c.personId, orgId: notice?.promotedOrgId ?? null, isAutoLogged: true, sourceRef,
        subject: `Opened a drafted email from the ${notice?.employer ?? 'layoff'} alert${c.variant ? ` (subject ${c.variant})` : ''}`,
        outcome: 'Clicked Write email in the layoff alert. The send is logged when Gmail syncs it.',
      },
    })
  } catch (e) {
    console.error('Compose click not logged:', e instanceof Error ? e.message : e)
  }
}
