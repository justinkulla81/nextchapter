import 'server-only'
import { prisma } from '@/lib/prisma'
import { findEmailOwner } from './email-owner'
import { refreshTouchFields } from './sync'

export interface RestoreResult {
  restored: { id: string; name: string }[]
  skipped: { id: string; name: string; reason: string }[]
}

/**
 * Brings removed people back — with the same rules as adding them.
 *
 * Removal is a soft delete, so restoring is just clearing it; what needs care
 * is not restoring a second copy of someone who is already live. A record
 * merged into another is a duplicate by definition. Beyond that, a removed
 * record whose email or LinkedIn profile now belongs to a live person would
 * break "one address, one person" — so those are held back and named, not
 * silently restored.
 */
export async function restorePeople(ids: string[], opts: { dryRun?: boolean } = {}): Promise<RestoreResult> {
  const result: RestoreResult = { restored: [], skipped: [] }
  const people = await prisma.crmPerson.findMany({
    where: { id: { in: [...new Set(ids)] }, deletedAt: { not: null } },
    select: {
      id: true, fullName: true, email: true, emails: true, linkedinUrl: true, mergedIntoId: true,
    },
  })

  for (const p of people) {
    if (p.mergedIntoId) {
      const into = await prisma.crmPerson.findUnique({ where: { id: p.mergedIntoId }, select: { fullName: true } })
      result.skipped.push({ id: p.id, name: p.fullName, reason: `merged into ${into?.fullName ?? 'another record'}` })
      continue
    }

    let clash: string | null = null
    for (const addr of new Set([p.email, ...p.emails].filter((e): e is string => Boolean(e)))) {
      const owner = await findEmailOwner(addr, { excludePersonId: p.id })
      if (owner) { clash = `${addr} is already on ${owner.fullName}`; break }
    }
    if (!clash && p.linkedinUrl) {
      const live = await prisma.crmPerson.findFirst({
        where: { deletedAt: null, id: { not: p.id }, linkedinUrl: p.linkedinUrl },
        select: { fullName: true },
      })
      if (live) clash = `their LinkedIn profile is already on ${live.fullName}`
    }
    if (clash) {
      result.skipped.push({ id: p.id, name: p.fullName, reason: clash })
      continue
    }

    if (!opts.dryRun) await prisma.crmPerson.update({ where: { id: p.id }, data: { deletedAt: null } })
    result.restored.push({ id: p.id, name: p.fullName })
  }

  // Their activity never went anywhere; the derived counts need recomputing
  // so they come back showing it.
  if (!opts.dryRun) await refreshTouchFields(result.restored.map((r) => r.id))
  return result
}
