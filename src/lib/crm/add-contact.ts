import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CrmGoal, CrmPersonRole } from '@prisma/client'
import { findEmailOwner } from './email-owner'
import { normalizeOrgName } from '@/lib/text/org-name-match'

export interface ContactToAdd {
  fullName: string
  title: string | null
  email: string | null
  /** An address worked out from a format, never written into email. */
  guessedEmail?: string | null
  guessedEmailBasis?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  orgId: string
  orgName: string
  roles: CrmPersonRole[]
  goals: CrmGoal[]
  priority: 'P0' | 'P1' | 'P2' | null
  note: string
}

export type AddResult =
  | { outcome: 'added' | 'matched' | 'review'; personId: string }
  | { outcome: 'removed' }

/**
 * Puts one contact in the CRM under the rules every other contact path
 * follows: an email already in the CRM is that person (their record gains the
 * roles, goals and affiliation, and a priority already set is kept); a person
 * taken out is never brought back; and a new person whose name matches
 * someone already in the CRM is added flagged for the Review List, so a merge
 * is decided by a person, not guessed. Someone already affiliated with the
 * same organization under the same name is that person.
 */
export async function addContactToCrm(c: ContactToAdd): Promise<AddResult> {
  const owner = c.email ? await findEmailOwner(c.email, { includeDeleted: true }) : null
  if (owner?.deleted) return { outcome: 'removed' }

  let personId: string
  let outcome: 'added' | 'matched' | 'review'
  if (owner) {
    const p = await prisma.crmPerson.findUniqueOrThrow({ where: { id: owner.id }, select: { roles: true, goals: true, priority: true } })
    await prisma.crmPerson.update({
      where: { id: owner.id },
      data: {
        roles: [...new Set([...p.roles, ...c.roles])],
        goals: [...new Set([...p.goals, ...c.goals])],
        ...(p.priority || !c.priority ? {} : { priority: c.priority }),
      },
    })
    personId = owner.id
    outcome = 'matched'
  } else {
    const sameName = await prisma.crmPerson.findMany({
      where: { fullName: { equals: c.fullName, mode: 'insensitive' } },
      select: { id: true, deletedAt: true, affiliations: { select: { orgId: true } } },
    })
    const atOrg = sameName.find((p) => !p.deletedAt && p.affiliations.some((a) => a.orgId === c.orgId))
    if (atOrg) {
      const p = await prisma.crmPerson.findUniqueOrThrow({ where: { id: atOrg.id }, select: { roles: true, goals: true, email: true, guessedEmail: true, priority: true } })
      await prisma.crmPerson.update({
        where: { id: atOrg.id },
        data: {
          roles: [...new Set([...p.roles, ...c.roles])],
          goals: [...new Set([...p.goals, ...c.goals])],
          ...(c.email && !p.email ? { email: c.email, emails: [c.email], guessedEmail: null, guessedEmailBasis: null } : {}),
          ...(!c.email && c.guessedEmail && !p.email && !p.guessedEmail ? { guessedEmail: c.guessedEmail, guessedEmailBasis: c.guessedEmailBasis ?? null } : {}),
          ...(p.priority || !c.priority ? {} : { priority: c.priority }),
        },
      })
      personId = atOrg.id
      outcome = 'matched'
    } else {
      // A removed person with this name and organization is not recreated.
      const removedHere = sameName.some((p) => p.deletedAt && p.affiliations.some((a) => a.orgId === c.orgId))
      if (removedHere) return { outcome: 'removed' }
      const live = sameName.find((p) => !p.deletedAt)
      const [firstName, ...rest] = c.fullName.split(' ')
      const person = await prisma.crmPerson.create({
        data: {
          fullName: c.fullName,
          firstName,
          lastName: rest.length ? rest[rest.length - 1] : null,
          email: c.email,
          emails: c.email ? [c.email] : [],
          guessedEmail: c.email ? null : c.guessedEmail ?? null,
          guessedEmailBasis: c.email ? null : c.guessedEmailBasis ?? null,
          phone: c.phone ?? null,
          linkedinUrl: c.linkedinUrl ?? null,
          roles: c.roles,
          goals: c.goals,
          priority: c.priority ?? undefined,
          normalizedKey: `${c.fullName.toLowerCase()}|${normalizeOrgName(c.orgName)}`,
          notes: live ? `${c.note}\n\nSomeone named ${c.fullName} is already in the CRM (${live.id}) — same person? Merge or clear on the Review List.` : c.note,
          needsCompletion: !!live,
        },
      })
      personId = person.id
      outcome = live ? 'review' : 'added'
    }
  }

  await prisma.crmAffiliation.upsert({
    where: { personId_orgId_title: { personId, orgId: c.orgId, title: c.title ?? '' } },
    update: { isCurrent: true },
    create: { personId, orgId: c.orgId, title: c.title, isPrimary: true, isCurrent: true },
  })
  return { outcome, personId }
}

/** An organization by name: the one already there, else a new one of the given type. */
export async function ensureOrg(o: {
  name: string
  type: 'GOVERNMENT' | 'EMPLOYER' | 'UNIVERSITY'
  website?: string | null
  city?: string | null
  state?: string | null
}): Promise<{ id: string; name: string }> {
  const canonical = normalizeOrgName(o.name)
  const existing = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: canonical }, select: { id: true, name: true, orgTypes: true } })
  if (existing) {
    if (!existing.orgTypes.includes(o.type)) {
      await prisma.crmOrganization.update({ where: { id: existing.id }, data: { orgTypes: { push: o.type } } })
    }
    return existing
  }
  return prisma.crmOrganization.create({
    data: {
      name: o.name, canonicalNameNormalized: canonical, orgTypes: [o.type],
      website: o.website ?? null, hqCity: o.city ?? null, hqRegion: o.state ?? null, usState: o.state ?? null,
    },
    select: { id: true, name: true },
  })
}
