'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isRealOrgName } from '@/lib/crm/normalize'
import type { CrmPersonRole, CrmLeadQuality, CrmWarmth } from '@prisma/client'

const CRM = '/support/admin/crm'

/** Bare slug from any LinkedIn profile URL, or null if it isn't one. */
function slugOf(input: string): string | null {
  const m = input.trim().toLowerCase().match(/linkedin\.com\/in\/([^/?#\s]+)/)
  return m ? m[1].replace(/\/+$/, '') : null
}

function nameKeyOf(name: string, orgKey: string | null): string | null {
  const n = name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
  return orgKey ? `${n}|${orgKey}` : null
}

export interface QuickAddCandidate {
  id: string
  fullName: string
  title: string | null
  org: string | null
  linkedinUrl: string | null
  roles: string[]
  lastTouchedAt: string | null
}

export interface QuickAddResult {
  status: 'created' | 'existing' | 'ambiguous' | 'error'
  personId?: string
  message: string
  /** Populated when status is 'ambiguous' — you choose merge or create. */
  candidates?: QuickAddCandidate[]
  /** Echoed back so the confirm step can re-submit the original input. */
  input?: string
  role?: string | null
}

async function candidatesFor(name: string, excludeId?: string): Promise<QuickAddCandidate[]> {
  const rows = await prisma.crmPerson.findMany({
    where: {
      fullName: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    take: 5,
    select: {
      id: true, fullName: true, linkedinUrl: true, roles: true, lastTouchedAt: true,
      affiliations: { where: { isPrimary: true }, take: 1, select: { title: true, org: { select: { name: true } } } },
    },
  })
  return rows.map((r) => ({
    id: r.id, fullName: r.fullName, linkedinUrl: r.linkedinUrl, roles: r.roles,
    title: r.affiliations[0]?.title ?? null,
    org: r.affiliations[0]?.org.name ?? null,
    lastTouchedAt: r.lastTouchedAt ? r.lastTouchedAt.toISOString() : null,
  }))
}

/** Resolves the prefill for an input, without writing anything. */
async function resolveInput(raw: string) {
  const slug = slugOf(raw)
  const match = slug ? await prisma.crmLinkedInConnection.findUnique({ where: { slug } }) : null
  const fullName = match
    ? `${match.firstName ?? ''} ${match.lastName ?? ''}`.trim()
    : slug
      ? slug.replace(/-+\d*$/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : raw
  return { slug, match, fullName }
}

async function createPerson(raw: string, role: CrmPersonRole | null, adminEmail: string): Promise<QuickAddResult> {
  const { slug, match, fullName } = await resolveInput(raw)
  if (!fullName) return { status: 'error', message: "Couldn't work out a name from that. Try typing the name instead." }

  let orgId: string | null = null
  let orgKey: string | null = null
  // "Self-employed" and friends are placeholders, not organisations — creating
  // one would give a junk org real affiliations pointing at it.
  if (isRealOrgName(match?.company)) {
    orgKey = normalizeOrgName(match.company)
    if (orgKey) {
      const org = await prisma.crmOrganization.upsert({
        where: { canonicalNameNormalized: orgKey },
        create: { name: match.company, canonicalNameNormalized: orgKey, orgTypes: ['EMPLOYER'] },
        update: {},
      })
      orgId = org.id
    }
  }

  const person = await prisma.crmPerson.create({
    data: {
      fullName,
      firstName: match?.firstName ?? fullName.split(' ')[0] ?? null,
      lastName: match?.lastName ?? (fullName.split(' ').slice(1).join(' ') || null),
      linkedinSlug: slug,
      linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : null,
      email: match?.email ?? null,
      emails: match?.email ? [match.email] : [],
      normalizedKey: nameKeyOf(fullName, orgKey),
      roles: role ? [role] : [],
      connectedAt: match?.connectedOn ?? null,
      needsCompletion: !match?.position || !orgId,
    },
  })
  if (orgId) {
    await prisma.crmAffiliation.create({ data: { personId: person.id, orgId, title: match?.position ?? '' } })
  }
  await prisma.crmSourceRecord.create({
    data: { sourceFile: 'QUICK_ADD', rawJson: { input: raw, prefilled: Boolean(match) }, personId: person.id, matchTier: 'CREATE' },
  })
  captureServerEvent(adminEmail, 'crm_person_quick_added', {
    personId: person.id, prefilled: Boolean(match), hadSlug: Boolean(slug), role: role ?? null,
  })
  revalidatePath(CRM)
  return {
    status: 'created',
    personId: person.id,
    message: match
      ? `Added ${fullName} — prefilled from your LinkedIn export.`
      : `Added ${fullName}. No export match, so a few fields are blank.`,
  }
}

/**
 * Quick add from a LinkedIn URL or a bare name.
 *
 * Prefill comes from CrmLinkedInConnection — the admin's own LinkedIn data
 * export — because LinkedIn profile pages cannot be fetched server-side: they
 * return a login wall to anything that isn't a signed-in browser, and working
 * around that would breach their terms.
 *
 * Duplicate handling is deliberately three-way, not two:
 *   - a matching LinkedIn slug or email IS the same person — merge silently,
 *     since those identifiers are unique by construction
 *   - a matching NAME is not evidence of anything (the import found 23 such
 *     collisions), so it STOPS and asks rather than guessing in either
 *     direction. Auto-merging invents a person who doesn't exist; auto-creating
 *     quietly splits one who does.
 */
export async function quickAddPerson(_prev: unknown, formData: FormData): Promise<QuickAddResult> {
  const admin = await requireAdmin()
  const adminEmail = admin.email ?? 'admin'
  const raw = String(formData.get('input') ?? '').trim()
  if (!raw) return { status: 'error', message: 'Enter a name or a LinkedIn URL.' }

  const roleRaw = String(formData.get('role') ?? '').trim()
  const role = roleRaw ? (roleRaw as CrmPersonRole) : null

  const { slug, match, fullName } = await resolveInput(raw)

  // Definitive identifiers — same person, no question to ask.
  if (slug) {
    const bySlug = await prisma.crmPerson.findUnique({ where: { linkedinSlug: slug } })
    if (bySlug) {
      if (role && !bySlug.roles.includes(role)) {
        await prisma.crmPerson.update({ where: { id: bySlug.id }, data: { roles: { push: role } } })
      }
      captureServerEvent(adminEmail, 'crm_quick_add_matched', { personId: bySlug.id, on: 'slug' })
      revalidatePath(CRM)
      return { status: 'existing', personId: bySlug.id, message: `${bySlug.fullName} is already in the CRM — opened their record.` }
    }
  }
  if (match?.email) {
    const byEmail = await prisma.crmPerson.findFirst({ where: { email: match.email } })
    if (byEmail) {
      captureServerEvent(adminEmail, 'crm_quick_add_matched', { personId: byEmail.id, on: 'email' })
      revalidatePath(CRM)
      return { status: 'existing', personId: byEmail.id, message: `${byEmail.fullName} is already in the CRM — matched on email.` }
    }
  }

  // Same name, no shared identifier: ask rather than guess.
  const near = await candidatesFor(fullName)
  if (near.length > 0) {
    captureServerEvent(adminEmail, 'crm_quick_add_ambiguous', { name: fullName, candidates: near.length })
    return {
      status: 'ambiguous',
      candidates: near,
      input: raw,
      role: roleRaw || null,
      message: near.length === 1
        ? `There's already a ${fullName} in the CRM. Merge into that record, or add a separate person?`
        : `There are ${near.length} people called ${fullName}. Merge into one, or add a separate person?`,
    }
  }

  return createPerson(raw, role, adminEmail)
}

/** Chosen from the ambiguity prompt: fold the new details into an existing record. */
export async function mergeIntoExisting(_prev: unknown, formData: FormData): Promise<QuickAddResult> {
  const admin = await requireAdmin()
  const adminEmail = admin.email ?? 'admin'
  const targetId = String(formData.get('targetId') ?? '')
  const raw = String(formData.get('input') ?? '').trim()
  const roleRaw = String(formData.get('role') ?? '').trim()
  if (!targetId) return { status: 'error', message: 'Pick a record to merge into.' }

  const { slug, match } = await resolveInput(raw)
  const target = await prisma.crmPerson.findUniqueOrThrow({ where: { id: targetId } })

  await prisma.crmPerson.update({
    where: { id: targetId },
    data: {
      linkedinSlug: target.linkedinSlug ?? slug,
      linkedinUrl: target.linkedinUrl ?? (slug ? `https://www.linkedin.com/in/${slug}` : null),
      email: target.email ?? match?.email ?? null,
      connectedAt: target.connectedAt ?? match?.connectedOn ?? null,
      ...(roleRaw && !target.roles.includes(roleRaw as CrmPersonRole)
        ? { roles: { push: roleRaw as CrmPersonRole } }
        : {}),
    },
  })
  await prisma.crmActivity.create({
    data: {
      type: 'FIELD_CHANGED', direction: 'INTERNAL', personId: targetId,
      subject: 'Merged from quick add', body: `input: ${raw}`, loggedByEmail: adminEmail,
    },
  })
  captureServerEvent(adminEmail, 'crm_quick_add_merged', { personId: targetId })
  revalidatePath(CRM)
  return { status: 'existing', personId: targetId, message: `Merged into ${target.fullName}.` }
}

/** Chosen from the ambiguity prompt: this really is a different person. */
export async function createAnyway(_prev: unknown, formData: FormData): Promise<QuickAddResult> {
  const admin = await requireAdmin()
  const raw = String(formData.get('input') ?? '').trim()
  const roleRaw = String(formData.get('role') ?? '').trim()
  return createPerson(raw, roleRaw ? (roleRaw as CrmPersonRole) : null, admin.email ?? 'admin')
}

/**
 * One-click log of a LinkedIn message.
 *
 * LinkedIn exposes no API for DMs, so this is the one channel that can never
 * log itself — hence a single control rather than a modal.
 */
export async function logLinkedInMessage(personId: string) {
  const admin = await requireAdmin()
  const now = new Date()
  const person = await prisma.crmPerson.findUniqueOrThrow({ where: { id: personId }, select: { touchCount: true, firstTouchedAt: true } })

  await prisma.crmActivity.create({
    data: {
      type: 'LINKEDIN_MESSAGE', direction: 'OUTBOUND', personId, occurredAt: now,
      subject: 'LinkedIn message', isAutoLogged: false, loggedByEmail: admin.email ?? null,
    },
  })
  await prisma.crmPerson.update({
    where: { id: personId },
    data: {
      lastTouchedAt: now,
      firstTouchedAt: person.firstTouchedAt ?? now,
      touchCount: person.touchCount + 1,
    },
  })

  captureServerEvent(admin.email ?? 'admin', 'crm_activity_logged', { personId, type: 'LINKEDIN_MESSAGE', auto: false })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
}

/** Inline edit from a list row or the record page. Writes a FIELD_CHANGED activity. */
export async function updatePersonField(personId: string, field: 'leadQuality' | 'warmth' | 'title' | 'notes', value: string) {
  const admin = await requireAdmin()
  const before = await prisma.crmPerson.findUnique({
    where: { id: personId },
    select: { leadQuality: true, warmth: true, notes: true },
  })

  if (field === 'title') {
    // Title lives on the affiliation, not the person — a title only means
    // anything relative to an organisation.
    const aff = await prisma.crmAffiliation.findFirst({ where: { personId, isPrimary: true } })
    if (aff) await prisma.crmAffiliation.update({ where: { id: aff.id }, data: { title: value || null } })
    await prisma.crmPerson.update({ where: { id: personId }, data: { needsCompletion: !value } })
  } else if (field === 'leadQuality') {
    await prisma.crmPerson.update({ where: { id: personId }, data: { leadQuality: value as CrmLeadQuality } })
  } else if (field === 'warmth') {
    await prisma.crmPerson.update({ where: { id: personId }, data: { warmth: value as CrmWarmth } })
  } else {
    await prisma.crmPerson.update({ where: { id: personId }, data: { notes: value || null } })
  }

  await prisma.crmActivity.create({
    data: {
      type: 'FIELD_CHANGED', direction: 'INTERNAL', personId,
      subject: `${field} changed`,
      body: `${field}: ${JSON.stringify(field === 'title' ? null : before?.[field] ?? null)} → ${JSON.stringify(value)}`,
      loggedByEmail: admin.email ?? null,
    },
  })

  captureServerEvent(admin.email ?? 'admin', 'crm_field_edited', { personId, field, surface: 'inline' })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
}

/** Set roles on one person (multi-select). */
export async function updatePersonRoles(personId: string, formData: FormData) {
  const admin = await requireAdmin()
  const roles = formData.getAll('roles').map(String) as CrmPersonRole[]
  await prisma.crmPerson.update({ where: { id: personId }, data: { roles: { set: roles } } })
  await prisma.crmActivity.create({
    data: { type: 'FIELD_CHANGED', direction: 'INTERNAL', personId, subject: 'roles changed', body: roles.join(', ') || '(none)', loggedByEmail: admin.email ?? null },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_field_edited', { personId, field: 'roles', count: roles.length, surface: 'record' })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
}

/**
 * Bulk edit from a list view. One undoable action rather than twenty, which is
 * the difference between the completion queue getting cleared and getting
 * ignored.
 */
export async function bulkUpdatePeople(formData: FormData) {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  const quality = String(formData.get('bulkQuality') ?? '')
  const warmth = String(formData.get('bulkWarmth') ?? '')
  const addRole = String(formData.get('bulkRole') ?? '')
  if (ids.length === 0) return

  const data: { leadQuality?: CrmLeadQuality; warmth?: CrmWarmth } = {}
  if (quality) data.leadQuality = quality as CrmLeadQuality
  if (warmth) data.warmth = warmth as CrmWarmth
  if (Object.keys(data).length > 0) {
    await prisma.crmPerson.updateMany({ where: { id: { in: ids } }, data })
  }
  if (addRole) {
    // push is per-row, so this can't be a single updateMany.
    const rows = await prisma.crmPerson.findMany({ where: { id: { in: ids } }, select: { id: true, roles: true } })
    await Promise.all(
      rows.filter((r) => !r.roles.includes(addRole as CrmPersonRole))
        .map((r) => prisma.crmPerson.update({ where: { id: r.id }, data: { roles: { push: addRole as CrmPersonRole } } }))
    )
  }

  await prisma.crmActivity.createMany({
    data: ids.map((id) => ({
      type: 'FIELD_CHANGED' as const, direction: 'INTERNAL' as const, personId: id,
      subject: 'bulk edit',
      body: [quality && `quality→${quality}`, warmth && `warmth→${warmth}`, addRole && `+role ${addRole}`].filter(Boolean).join(', '),
      loggedByEmail: admin.email ?? null,
    })),
  })

  captureServerEvent(admin.email ?? 'admin', 'crm_bulk_edited', {
    count: ids.length, quality: quality || null, warmth: warmth || null, addedRole: addRole || null,
  })
  revalidatePath(CRM)
}

/** Marks a profile complete without changing anything — "I looked, it's fine." */
export async function dismissCompletion(personId: string) {
  const admin = await requireAdmin()
  await prisma.crmPerson.update({ where: { id: personId }, data: { needsCompletion: false } })
  captureServerEvent(admin.email ?? 'admin', 'crm_completion_dismissed', { personId })
  revalidatePath(`${CRM}/needs-completion`)
}

/** Accepts the LinkedIn-export suggestion for a person missing a title or org. */
export async function acceptExportSuggestion(personId: string) {
  const admin = await requireAdmin()
  const person = await prisma.crmPerson.findUniqueOrThrow({
    where: { id: personId },
    select: { id: true, fullName: true, linkedinSlug: true, affiliations: { select: { id: true } } },
  })
  if (!person.linkedinSlug) return
  const sug = await prisma.crmLinkedInConnection.findUnique({ where: { slug: person.linkedinSlug } })
  if (!sug) return

  let orgId: string | null = null
  if (isRealOrgName(sug.company)) {
    const key = normalizeOrgName(sug.company)
    if (key) {
      const org = await prisma.crmOrganization.upsert({
        where: { canonicalNameNormalized: key },
        create: { name: sug.company, canonicalNameNormalized: key, orgTypes: ['EMPLOYER'] },
        update: {},
      })
      orgId = org.id
    }
  }
  if (orgId) {
    const existing = person.affiliations[0]
    if (existing) await prisma.crmAffiliation.update({ where: { id: existing.id }, data: { orgId, title: sug.position ?? '' } })
    else await prisma.crmAffiliation.create({ data: { personId, orgId, title: sug.position ?? '' } })
  }
  await prisma.crmPerson.update({ where: { id: personId }, data: { needsCompletion: false } })

  captureServerEvent(admin.email ?? 'admin', 'crm_completion_accepted', { personId, source: 'linkedin_export' })
  revalidatePath(`${CRM}/needs-completion`)
}
