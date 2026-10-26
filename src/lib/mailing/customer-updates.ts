import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeListEmail } from './rules'

/**
 * The monthly "Product updates for customers" email: what we added or changed
 * for employer, recruiter, coach and institution accounts that are activated.
 * Drafted free of model calls from src/data/customer-updates.ts and left as a
 * draft: it only sends after you approve it on the Monthly Update page.
 */

export { CUSTOMER_UPDATES_LIST_KEY, updatesSince, customerUpdatesBody } from './customer-updates-body'
import { CUSTOMER_UPDATES_LIST_KEY } from './customer-updates-body'

/**
 * Accounts that have actually started using a portal: an accepted invitation
 * for employers and institutions, a signed-in login with portal activity for
 * recruiters and coaches. Sample data is never included.
 */
export async function activatedB2bContacts(): Promise<{ email: string; name: string | null }[]> {
  const [employers, institutions, recruiters, coaches] = await Promise.all([
    prisma.outplacementOrgUser.findMany({ where: { acceptedAt: { not: null }, userId: { not: null } }, select: { invitedEmail: true, fullName: true } }),
    prisma.institutionUser.findMany({ where: { acceptedAt: { not: null }, revokedAt: null, isSampleData: false }, select: { invitedEmail: true, fullName: true } }),
    prisma.recruiter.findMany({ where: { userId: { not: null }, isSampleData: false }, select: { userId: true, workEmail: true, fullName: true } }),
    prisma.coach.findMany({ where: { userId: { not: null }, isSampleData: false }, select: { userId: true, workEmail: true, fullName: true } }),
  ])
  const active = await prisma.portalPageActivityEvent.findMany({
    where: { userId: { in: [...recruiters, ...coaches].map((p) => p.userId!) } },
    distinct: ['userId'],
    select: { userId: true },
  })
  const seen = new Set(active.map((a) => a.userId))
  const all = [
    ...employers.map((e) => ({ email: e.invitedEmail, name: e.fullName })),
    ...institutions.map((i) => ({ email: i.invitedEmail, name: i.fullName })),
    ...recruiters.filter((r) => seen.has(r.userId!)).map((r) => ({ email: r.workEmail, name: r.fullName })),
    ...coaches.filter((c) => seen.has(c.userId!)).map((c) => ({ email: c.workEmail, name: c.fullName })),
  ]
  const byEmail = new Map<string, { email: string; name: string | null }>()
  for (const p of all) {
    const email = normalizeListEmail(p.email)
    if (email && !byEmail.has(email)) byEmail.set(email, { email, name: p.name })
  }
  return [...byEmail.values()]
}

/**
 * Makes sure the list exists and holds every activated account. Only adds: it
 * never touches anyone already on the list, unsubscribed, bounced or
 * suppressed, so nobody who opted out comes back.
 */
export async function syncCustomerUpdatesList(opts: { dryRun?: boolean } = {}): Promise<{ added: number; activated: number }> {
  const list = await prisma.mailingList.upsert({
    where: { key: CUSTOMER_UPDATES_LIST_KEY },
    update: {},
    create: {
      key: CUSTOMER_UPDATES_LIST_KEY,
      name: 'Product updates for customers',
      description: 'A monthly note on what we added or changed, for accounts that are activated. Drafted for you to approve.',
      audience: 'Activated employer, recruiter, coach and institution accounts',
      cadence: 'MONTHLY',
      isActive: true,
      sortOrder: 40,
    },
  })
  const contacts = await activatedB2bContacts()
  const emails = contacts.map((c) => c.email)
  const [existing, suppressed] = await Promise.all([
    prisma.mailingListMember.findMany({ where: { listId: list.id, email: { in: emails } }, select: { email: true } }),
    prisma.mailingSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } }),
  ])
  const have = new Set(existing.map((m) => m.email))
  const blocked = new Set(suppressed.map((s) => s.email))
  const fresh = contacts.filter((c) => !have.has(c.email) && !blocked.has(c.email))
  if (!opts.dryRun && fresh.length) {
    await prisma.mailingListMember.createMany({
      data: fresh.map((c) => ({ listId: list.id, email: c.email, status: 'ACTIVE' as const, addedVia: 'IMPORT' as const, consentNote: 'Activated B2B account (customer relationship)' })),
      skipDuplicates: true,
    })
  }
  if (!opts.dryRun && fresh.length) captureServerEvent('system', 'customer_updates_list_synced', { added: fresh.length, activated: contacts.length })
  return { added: fresh.length, activated: contacts.length }
}
