import 'server-only'
import { createHash } from 'node:crypto'
import type { CrmOrgType, CrmPersonRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { strictOrgKey, isRealOrgName } from '@/lib/crm/normalize'
import { slugOf } from '@/lib/crm/linkedin'
import { normalizeEmail } from '@/lib/crm/sync-matching'
import { goalsForOrgTypes, goalsForRoles } from '@/lib/crm/goals'
import { parseP0Leads, type P0Lead } from '@/lib/crm/p0-leads-parse'

export { parseP0Leads, type P0Lead }

/**
 * Rapid response leads from the daily digest, filed as P0.
 *
 * There is no separate rapid-response pipeline: P0 is the list. A trigger —
 * a WARN filing, a layoff story, an RFP, local coverage, someone quoted — is
 * turned by the digest into one lead per local organization that should hear
 * from us (the employer, the workforce board, a nearby college), each with a
 * named contact where one can be found.
 *
 * P0 is a tier on people, and an organization shows in the P0 queue through
 * its P0 contacts, so a lead with no contact gets a follow-up task to find
 * one instead of a tier it has nowhere to hold.
 *
 * The trigger is logged as a note on the ORGANIZATION, never the person: any
 * activity on a person counts as a touch (see REAL_TOUCH), and a lead nobody
 * has contacted must not read as "last contacted today".
 *
 * With p0: false the same path only records the contact — a phone number
 * someone shared, a title — and leaves their tier and next step alone.
 *
 * A person is reused only on a hard key (LinkedIn slug, email) or the same
 * name at the same organization. The same name somewhere else is created as
 * a new person, which puts the pair on the CRM Review List's Duplicates tab
 * for a human to merge rather than guessing here.
 */

export interface P0LeadResult {
  org: { id: string; name: string; created: boolean }
  person: { id: string; fullName: string; created: boolean; possibleDuplicate: boolean } | null
  taskId: string | null
  alreadyLogged: boolean
}

const RR_ROLE_FOR_ORG: Partial<Record<CrmOrgType, CrmPersonRole>> = {
  EMPLOYER: 'OUTPLACEMENT_BUYER',
  OUTPLACEMENT_LEAD: 'OUTPLACEMENT_BUYER',
  GOVERNMENT: 'BD_PARTNER',
  UNIVERSITY: 'BD_PARTNER',
  NONPROFIT: 'BD_PARTNER',
  FOUNDATION: 'GRANTS',
  FUNDER_GRANT: 'GRANTS',
  MEDIA: 'PRESS',
  THINK_TANK: 'POLICY_ANALYST',
}

function nameKeyOf(name: string, orgKey: string | null): string | null {
  const n = name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
  return orgKey ? `${n}|${orgKey}` : null
}

function day(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

export async function importP0Leads(leads: P0Lead[], dryRun = false): Promise<P0LeadResult[]> {
  const orgs = await prisma.crmOrganization.findMany({ select: { id: true, name: true, orgTypes: true, goals: true } })
  const results: P0LeadResult[] = []

  for (const lead of leads) {
    const { trigger } = lead
    const strict = strictOrgKey(lead.org.name, normalizeOrgName)
    const canonical = normalizeOrgName(lead.org.name)
    const match = orgs.find((o) => strictOrgKey(o.name, normalizeOrgName) === strict)
    const sourceRef = `p0lead:${createHash('sha1').update(`${trigger.sourceUrl}|${strict}|${lead.person?.fullName ?? ''}`).digest('hex').slice(0, 24)}`
    const alreadyLogged = Boolean(await prisma.crmActivity.findUnique({ where: { type_sourceRef: { type: 'NOTE', sourceRef } } }))

    if (dryRun || alreadyLogged) {
      results.push({
        org: { id: match?.id ?? '', name: match?.name ?? lead.org.name, created: !match },
        person: lead.person ? { id: '', fullName: lead.person.fullName, created: false, possibleDuplicate: false } : null,
        taskId: null,
        alreadyLogged,
      })
      continue
    }

    // ── organization ──
    const org = match
      ? await prisma.crmOrganization.update({
          where: { id: match.id },
          data: {
            ...(match.orgTypes.includes(lead.org.type) ? {} : { orgTypes: { push: lead.org.type } }),
            ...goalsForOrgTypes([lead.org.type]).filter((g) => !match.goals.includes(g)).length
              ? { goals: { push: goalsForOrgTypes([lead.org.type]).filter((g) => !match.goals.includes(g)) } }
              : {},
          },
        })
      : await prisma.crmOrganization.upsert({
          where: { canonicalNameNormalized: canonical },
          create: {
            name: lead.org.name,
            canonicalNameNormalized: canonical,
            orgTypes: [lead.org.type],
            goals: goalsForOrgTypes([lead.org.type]),
            website: lead.org.website,
            hqCity: lead.org.city ?? trigger.city,
            hqRegion: trigger.county,
            usState: lead.org.state ?? trigger.state,
          },
          update: {},
        })
    if (!match) orgs.push({ id: org.id, name: org.name, orgTypes: org.orgTypes, goals: org.goals })

    const headline = `${trigger.kind.replace('_', ' ').toLowerCase()}: ${trigger.headline}`
    const label = lead.p0 ? 'P0 rapid response' : 'CRM update'
    await prisma.crmActivity.create({
      data: {
        type: 'NOTE', direction: 'INTERNAL', orgId: org.id, isAutoLogged: true, sourceRef,
        occurredAt: trigger.publishedAt ?? new Date(),
        subject: `${label} — ${headline}`.slice(0, 300),
        body: [lead.why, trigger.summary, trigger.employees ? `${trigger.employees} workers affected.` : null,
          [trigger.city, trigger.county && `${trigger.county} County`, trigger.state].filter(Boolean).join(', ') || null,
          trigger.sourceUrl, lead.person ? `Contact: ${lead.person.fullName}${lead.person.title ? `, ${lead.person.title}` : ''}` : null,
        ].filter(Boolean).join('\n'),
      },
    })

    if (trigger.deadline) {
      const label = trigger.kind === 'RFP' ? 'RFP due' : trigger.kind === 'WARN' ? 'Layoff effective' : 'Rapid response deadline'
      const existing = await prisma.crmDeadline.findFirst({ where: { orgId: org.id, label, dueAt: trigger.deadline } })
      if (!existing) {
        await prisma.crmDeadline.create({
          data: { orgId: org.id, label, dueAt: trigger.deadline, kind: trigger.kind === 'RFP' ? 'APPLICATION_CLOSE' : 'EVENT', sourceUrl: trigger.sourceUrl },
        })
      }
    }

    // The employer's Company row carries its own tier, shown on the Layoff
    // notices page next to its filings. Only an existing row is tiered —
    // creating Company records is the WARN matcher's job.
    if (lead.p0 && (lead.org.type === 'EMPLOYER' || lead.org.type === 'OUTPLACEMENT_LEAD')) {
      await prisma.company.updateMany({ where: { canonicalNameNormalized: canonical }, data: { priority: 'P0' } })
    }

    // ── person ──
    let person: P0LeadResult['person'] = null
    let taskId: string | null = null
    const followUpNote = `${label} — ${headline}${lead.why ? `. ${lead.why}` : ''}`.slice(0, 1000)

    if (lead.person) {
      const p = lead.person
      const slug = slugOf(p.linkedinUrl)
      const email = normalizeEmail(p.email)
      const sameOrgKey = nameKeyOf(p.fullName, canonical)
      const existing =
        (slug && await prisma.crmPerson.findUnique({ where: { linkedinSlug: slug } })) ||
        (email && await prisma.crmPerson.findFirst({ where: { deletedAt: null, OR: [{ email }, { emails: { has: email } }] } })) ||
        await prisma.crmPerson.findFirst({
          where: {
            deletedAt: null, fullName: { equals: p.fullName, mode: 'insensitive' },
            affiliations: { some: { orgId: org.id } },
          },
        }) ||
        (sameOrgKey && await prisma.crmPerson.findFirst({ where: { deletedAt: null, normalizedKey: sameOrgKey } })) ||
        null

      const role = p.role ?? RR_ROLE_FOR_ORG[lead.org.type] ?? 'OTHER'
      if (existing && !existing.deletedAt) {
        const roles = existing.roles.includes(role) ? existing.roles : [...existing.roles, role]
        const keepEarlier = existing.nextFollowUpAt && existing.nextFollowUpAt <= new Date()
        // A shared number fills an empty field; a different one is kept in the
        // notes rather than overwriting what a human may have entered.
        const samePhone = (a: string | null, b: string) => (a ?? '').replace(/\D/g, '').endsWith(b.replace(/\D/g, '').slice(-10))
        const phoneData = !p.phone ? {}
          : !existing.phone ? { phone: p.phone }
          : samePhone(existing.phone, p.phone) ? {}
          : { notes: [existing.notes, `Also shared phone ${p.phone} (${day(trigger.publishedAt ?? new Date())}) — ${trigger.sourceUrl}`].filter(Boolean).join('\n') }
        await prisma.crmPerson.update({
          where: { id: existing.id },
          data: {
            ...(lead.p0 ? {
              priority: 'P0',
              roles,
              goals: [...new Set([...existing.goals, ...goalsForRoles(roles)])],
              ...(keepEarlier ? {} : { nextFollowUpAt: new Date(), nextFollowUpNote: followUpNote }),
              queueSnoozedAt: null,
            } : {}),
            ...phoneData,
          },
        })
        const linked = await prisma.crmAffiliation.findFirst({ where: { personId: existing.id, orgId: org.id } })
        if (!linked) {
          await prisma.crmAffiliation.create({ data: { personId: existing.id, orgId: org.id, title: p.title ?? '', isPrimary: false } })
        }
        person = { id: existing.id, fullName: existing.fullName, created: false, possibleDuplicate: false }
      } else {
        const sameName = await prisma.crmPerson.count({ where: { deletedAt: null, fullName: { equals: p.fullName, mode: 'insensitive' } } })
        const created = await prisma.crmPerson.create({
          data: {
            fullName: p.fullName,
            firstName: p.fullName.split(' ')[0] ?? null,
            lastName: p.fullName.split(' ').slice(1).join(' ') || null,
            linkedinSlug: slug,
            linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : null,
            email,
            emails: email ? [email] : [],
            phone: p.phone,
            normalizedKey: sameOrgKey,
            roles: [role],
            goals: goalsForRoles([role]),
            location: [trigger.city, trigger.state].filter(Boolean).join(', ') || null,
            ...(lead.p0 ? { priority: 'P0' as const, nextFollowUpAt: new Date(), nextFollowUpNote: followUpNote } : {}),
            needsCompletion: !p.title || !isRealOrgName(org.name),
            notes: p.quote ? `Quoted ${day(trigger.publishedAt)}: "${p.quote}" — ${trigger.sourceUrl}` : null,
          },
        })
        await prisma.crmAffiliation.create({ data: { personId: created.id, orgId: org.id, title: p.title ?? '' } })
        await prisma.crmSourceRecord.create({
          data: {
            sourceFile: 'MANUAL', personId: created.id, orgId: org.id, matchTier: sameName ? 'REVIEW · name only' : 'CREATE',
            rawJson: { via: 'daily-digest-p0-lead', trigger: { ...trigger, publishedAt: day(trigger.publishedAt), deadline: day(trigger.deadline) }, person: p },
          },
        })
        person = { id: created.id, fullName: created.fullName, created: true, possibleDuplicate: sameName > 0 }
      }
    } else if (lead.p0) {
      const open = await prisma.crmTask.findFirst({ where: { orgId: org.id, status: 'OPEN', title: { startsWith: 'Find a contact' } } })
      taskId = open?.id ?? (await prisma.crmTask.create({
        data: {
          orgId: org.id, kind: 'FOLLOW_UP', dueAt: new Date(),
          title: `Find a contact at ${org.name} (P0 rapid response)`.slice(0, 300),
          notes: [followUpNote, trigger.sourceUrl].join('\n'),
        },
      })).id
    }

    results.push({ org: { id: org.id, name: org.name, created: !match }, person, taskId, alreadyLogged: false })
  }
  return results
}
