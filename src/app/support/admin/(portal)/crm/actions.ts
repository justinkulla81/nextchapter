'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isRealOrgName, isOrgQuickPick, placeholderOrgKindFor, ORG_PLACEHOLDER_NAME, type OrgPlaceholderKind } from '@/lib/crm/normalize'
import { isPlaceholderName } from '@/lib/resume/placeholder-name'
import { extractDateCandidates, htmlToText } from '@/lib/crm/date-check'
import { refreshTouchFields } from '@/lib/crm/sync'
import { getSendAsAddresses } from '@/lib/google/gmail'
import { normalizeEmail } from '@/lib/crm/sync-matching'
import { findEmailOwner } from '@/lib/crm/email-owner'
import { logManualContact } from '@/lib/crm/log-contact'
import { restorePeople, type RestoreResult } from '@/lib/crm/restore'
import { completionUpdate } from '@/lib/crm/completion'
import { getValidAccessToken } from '@/lib/google/connection'
import { sendGmailMessage } from '@/lib/google/gmail'
import { buildTrackedHtml, extractUrls } from '@/lib/crm/outreach'
import { PERSON_ROLE_LABELS } from '@/lib/crm/labels'
import type {
  CrmPersonRole, CrmLeadQuality, CrmWarmth,
  CrmIntroPathStrength, CrmIntroPathStatus, CrmResearchStance,
  CrmFunderKind, CrmValueType,
  CrmOrgType, CrmGoal, CrmEligibility, CrmOpportunityOutcome, CrmPriorityTier, Prisma,
} from '@prisma/client'

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
  roles?: string[]
}

async function candidatesFor(name: string, excludeId?: string): Promise<QuickAddCandidate[]> {
  const rows = await prisma.crmPerson.findMany({
    where: {
      fullName: { equals: name, mode: 'insensitive' },
      deletedAt: null,
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
  const withoutTrailingId = slug ? slug.replace(/-+\d*$/, '') : null
  // A hyphen is the ONLY word-boundary signal a raw slug carries — LinkedIn
  // slugs are always lowercase, so there is no capitalization to split on
  // either. A slug like "jordanclemons" (the person picked a custom slug
  // with no hyphen) title-cases to the single garbled word "Jordanclemons"
  // with no way to know where "Jordan" ends and "Clemons" begins. Rather
  // than silently writing that wrong name, this is treated as unparseable —
  // same as no name at all, prompting for a typed name instead.
  const slugDerivedName = withoutTrailingId && withoutTrailingId.includes('-')
    ? withoutTrailingId.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : null
  // Real, confirmed bug: LinkedIn assigns purely-numeric-suffixed slugs to
  // confidential/placeholder-name profiles too (e.g. "candidate-123456789"),
  // so this title-casing can produce a generic word that LOOKS like a name
  // but isn't one ("Candidate") — that word then got written straight into
  // CrmPerson.fullName with no plausibility check, same class of bug
  // extract-profile-fields.ts already guards against for resume names (see
  // isPlaceholderName's own comment). A generic result here is treated the
  // same as no name at all — never silently used to create a record.
  const fullName = match
    ? `${match.firstName ?? ''} ${match.lastName ?? ''}`.trim()
    : slug
      ? (slugDerivedName && !isPlaceholderName(slugDerivedName) ? slugDerivedName : null)
      : raw
  return { slug, match, fullName }
}

async function createPerson(raw: string, roles: CrmPersonRole[], adminEmail: string): Promise<QuickAddResult> {
  const { slug, match, fullName } = await resolveInput(raw)
  if (!fullName) return { status: 'error', message: "Couldn't work out a name from that. Try typing the name instead." }

  let orgId: string | null = null
  let orgKey: string | null = null
  // "Self-employed" and friends are placeholders, not organizations — creating
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
      roles,
      connectedAt: match?.connectedOn ?? null,
      needsCompletion: !match?.position || !orgId,
      // A real email is a real, reachable contact — worth a baseline
      // follow-up by default rather than sitting unprioritized.
      priority: match?.email ? 'P2' : undefined,
    },
  })
  if (orgId) {
    await prisma.crmAffiliation.create({ data: { personId: person.id, orgId, title: match?.position ?? '' } })
  }
  await prisma.crmSourceRecord.create({
    data: { sourceFile: 'QUICK_ADD', rawJson: { input: raw, prefilled: Boolean(match) }, personId: person.id, matchTier: 'CREATE' },
  })
  captureServerEvent(adminEmail, 'crm_person_quick_added', {
    personId: person.id, prefilled: Boolean(match), hadSlug: Boolean(slug), roles,
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

  const roles = formData.getAll('roles').map(String).filter(Boolean) as CrmPersonRole[]

  const { slug, match, fullName } = await resolveInput(raw)
  if (!fullName) return { status: 'error', message: "Couldn't work out a name from that. Try typing the name instead." }

  // Definitive identifiers — same person, no question to ask. A deleted
  // match falls through to create-a-new-person below rather than silently
  // reviving the old row, same "skip, don't resurrect" rule as CSV import.
  if (slug) {
    const bySlug = await prisma.crmPerson.findUnique({ where: { linkedinSlug: slug } })
    if (bySlug && bySlug.deletedAt) {
      return { status: 'error', message: `${bySlug.fullName} was previously removed from the Ecosystem. Restore them from a full backup if that was a mistake — this won't recreate them.` }
    }
    if (bySlug) {
      const missing = roles.filter((r) => !bySlug.roles.includes(r))
      if (missing.length > 0) {
        await prisma.crmPerson.update({ where: { id: bySlug.id }, data: { roles: { push: missing } } })
      }
      captureServerEvent(adminEmail, 'crm_quick_add_matched', { personId: bySlug.id, on: 'slug' })
      revalidatePath(CRM)
      return { status: 'existing', personId: bySlug.id, message: `${bySlug.fullName} is already in the Ecosystem — opened their record.` }
    }
  }
  if (match?.email) {
    // Every address the person holds, and Gmail's dot/plus variants — not
    // just the primary `email` column, which is all this used to check.
    const byEmail = await findEmailOwner(match.email, { includeDeleted: true })
    if (byEmail?.deleted) {
      return { status: 'error', message: `${byEmail.fullName} was previously removed from the Ecosystem. Restore them from a full backup if that was a mistake — this won't recreate them.` }
    }
    if (byEmail) {
      captureServerEvent(adminEmail, 'crm_quick_add_matched', { personId: byEmail.id, on: 'email' })
      revalidatePath(CRM)
      return { status: 'existing', personId: byEmail.id, message: `${byEmail.fullName} is already in the Ecosystem with ${match.email} — opened their record.` }
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
      roles,
      message: near.length === 1
        ? `There's already a ${fullName} in the CRM. Merge into that record, or add a separate person?`
        : `There are ${near.length} people called ${fullName}. Merge into one, or add a separate person?`,
    }
  }

  return createPerson(raw, roles, adminEmail)
}

/** Chosen from the ambiguity prompt: fold the new details into an existing record. */
export async function mergeIntoExisting(_prev: unknown, formData: FormData): Promise<QuickAddResult> {
  const admin = await requireAdmin()
  const adminEmail = admin.email ?? 'admin'
  const targetId = String(formData.get('targetId') ?? '')
  const raw = String(formData.get('input') ?? '').trim()
  const roles = formData.getAll('roles').map(String).filter(Boolean) as CrmPersonRole[]
  if (!targetId) return { status: 'error', message: 'Pick a record to merge into.' }

  const { slug, match } = await resolveInput(raw)
  const target = await prisma.crmPerson.findUniqueOrThrow({ where: { id: targetId } })
  const missingRoles = roles.filter((r) => !target.roles.includes(r))

  await prisma.crmPerson.update({
    where: { id: targetId },
    data: {
      linkedinSlug: target.linkedinSlug ?? slug,
      linkedinUrl: target.linkedinUrl ?? (slug ? `https://www.linkedin.com/in/${slug}` : null),
      email: target.email ?? match?.email ?? null,
      connectedAt: target.connectedAt ?? match?.connectedOn ?? null,
      ...(missingRoles.length > 0 ? { roles: { push: missingRoles } } : {}),
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
  const roles = formData.getAll('roles').map(String).filter(Boolean) as CrmPersonRole[]
  return createPerson(raw, roles, admin.email ?? 'admin')
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
export async function updatePersonField(personId: string, field: 'leadQuality' | 'warmth' | 'title' | 'notes' | 'priority' | 'fullName' | 'location', value: string) {
  const admin = await requireAdmin()
  const before = await prisma.crmPerson.findUnique({
    where: { id: personId },
    select: {
      leadQuality: true, warmth: true, notes: true, priority: true, fullName: true, location: true,
      needsCompletion: true,
    },
  })

  if (field === 'title') {
    // Title lives on the affiliation, not the person — a title only means
    // anything relative to an organization.
    const aff = await prisma.crmAffiliation.findFirst({ where: { personId, isPrimary: true } })
    if (aff) await prisma.crmAffiliation.update({ where: { id: aff.id }, data: { title: value || null } })
    await prisma.crmPerson.update({
      where: { id: personId },
      data: completionUpdate(!value, before?.needsCompletion ?? true),
    })
  } else if (field === 'leadQuality') {
    await prisma.crmPerson.update({ where: { id: personId }, data: { leadQuality: value as CrmLeadQuality } })
  } else if (field === 'warmth') {
    await prisma.crmPerson.update({ where: { id: personId }, data: { warmth: value as CrmWarmth } })
  } else if (field === 'priority') {
    await prisma.crmPerson.update({ where: { id: personId }, data: { priority: value ? (value as CrmPriorityTier) : null } })
  } else if (field === 'fullName') {
    const name = value.trim()
    if (!name) return
    await prisma.crmPerson.update({ where: { id: personId }, data: { fullName: name } })
  } else if (field === 'location') {
    await prisma.crmPerson.update({ where: { id: personId }, data: { location: value.trim() || null } })
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

/**
 * Logs a call and, optionally, sets a follow-up reminder in one step — the
 * peek panel's "Log a call" form. A follow-up can be flagged with no
 * specific date (checked, date left blank) — nextFollowUpAt stays null but
 * nextFollowUpNote still records that one's wanted. Only touches those two
 * fields when the checkbox is actually ticked, so logging call #2 never
 * silently wipes a still-pending reminder set from call #1.
 */
export async function logCallWithFollowUp(personId: string, formData: FormData) {
  const admin = await requireAdmin()
  const occurredRaw = String(formData.get('occurredAt') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim() || null
  const needsFollowUp = formData.get('needsFollowUp') === 'on'
  const followUpRaw = String(formData.get('followUpAt') ?? '').trim()
  // Noon UTC, not midnight — a plain "2026-09-15" parsed as midnight UTC
  // displays as the previous day in any negative-offset timezone.
  const occurredAt = occurredRaw ? new Date(`${occurredRaw}T12:00:00Z`) : new Date()

  const person = await prisma.crmPerson.findUniqueOrThrow({
    where: { id: personId },
    select: { touchCount: true, firstTouchedAt: true, lastTouchedAt: true },
  })

  await prisma.crmActivity.create({
    data: {
      type: 'CALL', direction: 'OUTBOUND', personId, occurredAt,
      subject: 'Call logged', body: note, isAutoLogged: false, loggedByEmail: admin.email ?? null,
    },
  })
  await prisma.crmPerson.update({
    where: { id: personId },
    data: {
      lastTouchedAt: !person.lastTouchedAt || occurredAt > person.lastTouchedAt ? occurredAt : undefined,
      firstTouchedAt: person.firstTouchedAt ?? occurredAt,
      touchCount: person.touchCount + 1,
      ...(needsFollowUp
        ? { nextFollowUpAt: followUpRaw ? new Date(`${followUpRaw}T12:00:00Z`) : null, nextFollowUpNote: note }
        : {}),
    },
  })

  captureServerEvent(admin.email ?? 'admin', 'crm_activity_logged', { personId, type: 'CALL', auto: false, hasFollowUp: Boolean(followUpRaw) })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
}

/** Sets (or updates) a follow-up reminder directly, with no call attached. */
export async function setPersonFollowUp(personId: string, note: string, dateStr: string) {
  const admin = await requireAdmin()
  await prisma.crmPerson.update({
    where: { id: personId },
    data: {
      nextFollowUpNote: note.trim() || null,
      // Noon UTC, not midnight — see logCallWithFollowUp's own comment.
      nextFollowUpAt: dateStr ? new Date(`${dateStr}T12:00:00Z`) : null,
      // Scheduling a real next step is a decision to keep pursuing —
      // mutually exclusive with having passed on them or parking them.
      passedAt: null,
      keepInTouchAt: null,
    },
  })
  await removeFromNewsletter(personId)
  captureServerEvent(admin.email ?? 'admin', 'crm_followup_set', { personId, hasDate: Boolean(dateStr) })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
}

/** Marks a follow-up reminder done — clears it without requiring a new call. */
export async function clearPersonFollowUp(personId: string) {
  const admin = await requireAdmin()
  await prisma.crmPerson.update({ where: { id: personId }, data: { nextFollowUpAt: null, nextFollowUpNote: null, passedAt: null, keepInTouchAt: null } })
  await removeFromNewsletter(personId)
  captureServerEvent(admin.email ?? 'admin', 'crm_followup_cleared', { personId })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
}

const NEWSLETTER_SEGMENT = 'Quarterly newsletter'

async function removeFromNewsletter(personId: string) {
  await prisma.crmSegmentMember.deleteMany({ where: { personId, segment: { name: NEWSLETTER_SEGMENT } } })
}

/**
 * "Replied, just keep in touch" — no next step to chase, so it clears any
 * pending one and pins the person into a "Quarterly newsletter" segment (made
 * on first use). Sending is still a separate, deliberate step from Segments.
 */
export async function markPersonKeepInTouch(personId: string) {
  const admin = await requireAdmin()
  const segment = await prisma.crmSegment.upsert({
    where: { name: NEWSLETTER_SEGMENT },
    create: { name: NEWSLETTER_SEGMENT, kind: 'PINNED', description: 'People who replied and asked to be kept in the loop.' },
    update: {},
  })
  await prisma.$transaction([
    prisma.crmPerson.update({
      where: { id: personId },
      data: { keepInTouchAt: new Date(), passedAt: null, nextFollowUpAt: null, nextFollowUpNote: null },
    }),
    prisma.crmSegmentMember.upsert({
      where: { segmentId_personId: { segmentId: segment.id, personId } },
      create: { segmentId: segment.id, personId },
      update: { isExcluded: false },
    }),
  ])
  captureServerEvent(admin.email ?? 'admin', 'crm_person_keep_in_touch', { personId })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
}

/**
 * "No current interest" — the third resolution for a follow-up, distinct
 * from clearing it: clearing says the reminder is done and says nothing
 * about the relationship, this says the pursuit is over (for now). Clears
 * any pending next step, since a passed deal has no next step; does NOT
 * touch priority/warmth/roles — passing on a follow-up doesn't mean the
 * person themselves stopped mattering.
 */
export async function markPersonPassed(personId: string) {
  const admin = await requireAdmin()
  await prisma.crmPerson.update({
    where: { id: personId },
    data: { passedAt: new Date(), keepInTouchAt: null, nextFollowUpAt: null, nextFollowUpNote: null },
  })
  await removeFromNewsletter(personId)
  captureServerEvent(admin.email ?? 'admin', 'crm_person_passed', { personId })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
}

/** Inline edit of an organization's own quality grade, from its detail page. */
export async function updateOrgQuality(orgId: string, value: string) {
  const admin = await requireAdmin()
  await prisma.crmOrganization.update({ where: { id: orgId }, data: { leadQuality: value as CrmLeadQuality } })
  captureServerEvent(admin.email ?? 'admin', 'crm_field_edited', { orgId, field: 'leadQuality', surface: 'record' })
  revalidatePath(`${CRM}/organizations/${orgId}`)
  revalidatePath(`${CRM}/organizations`)
}

/** Inline edit of a person's primary organization from a list row. */
export async function updatePersonPrimaryOrg(personId: string, orgNameRaw: string) {
  const admin = await requireAdmin()
  const orgName = orgNameRaw.trim()

  let orgId: string | null = null
  if (isOrgQuickPick(orgName) || isRealOrgName(orgName)) {
    const key = normalizeOrgName(orgName)
    if (key) {
      const org = await prisma.crmOrganization.upsert({
        where: { canonicalNameNormalized: key },
        create: { name: orgName, canonicalNameNormalized: key, orgTypes: ['EMPLOYER'] },
        update: {},
      })
      orgId = org.id
    }
  }

  const existing = await prisma.crmAffiliation.findFirst({ where: { personId, isPrimary: true } })
  if (orgId) {
    if (existing) await prisma.crmAffiliation.update({ where: { id: existing.id }, data: { orgId } })
    else await prisma.crmAffiliation.create({ data: { personId, orgId, isPrimary: true } })
  } else if (existing) {
    // Cleared the field — remove the primary affiliation rather than leaving
    // a row that points nowhere.
    await prisma.crmAffiliation.delete({ where: { id: existing.id } })
  }

  await prisma.crmActivity.create({
    data: {
      type: 'FIELD_CHANGED', direction: 'INTERNAL', personId,
      subject: 'organization changed', body: orgName || '(cleared)', loggedByEmail: admin.email ?? null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_field_edited', { personId, field: 'organization', surface: 'inline' })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
}

/** Set roles on one person (multi-select). */
/**
 * Setting a contact type on a record with no title yet also fills the
 * title in, on the theory that a blank title next to a freshly-set contact
 * type is more often an oversight than a deliberate choice to leave it
 * blank: the LinkedIn export's own position text wins when there is one
 * (e.g. "Independent Investor & Advisor"), otherwise the role label itself
 * ("Coach", "Recruiter") is a reasonable placeholder. A title can only live
 * on an affiliation, which requires an org — so this can create one from
 * the export's company, but if there's neither an existing org nor an
 * export to source one from, the title stays blank; nothing here invents
 * an organization out of nothing.
 */
export async function updatePersonRoles(personId: string, formData: FormData) {
  const admin = await requireAdmin()
  const roles = formData.getAll('roles').map(String) as CrmPersonRole[]
  await prisma.crmPerson.update({ where: { id: personId }, data: { roles: { set: roles } } })

  if (roles.length > 0) {
    const person = await prisma.crmPerson.findUniqueOrThrow({
      where: { id: personId },
      select: { linkedinSlug: true, affiliations: { take: 1, select: { id: true, orgId: true, title: true } } },
    })
    const existing = person.affiliations[0]
    const sug = person.linkedinSlug
      ? await prisma.crmLinkedInConnection.findUnique({ where: { slug: person.linkedinSlug } })
      : null
    const roleTitle = roles.map((r) => PERSON_ROLE_LABELS[r]).join(' / ')

    let gotTitle = false
    if (existing && !existing.title) {
      await prisma.crmAffiliation.update({ where: { id: existing.id }, data: { title: sug?.position || roleTitle } })
      gotTitle = true
    } else if (!existing && sug && isRealOrgName(sug.company)) {
      const key = normalizeOrgName(sug.company)
      if (key) {
        const org = await prisma.crmOrganization.upsert({
          where: { canonicalNameNormalized: key },
          create: { name: sug.company, canonicalNameNormalized: key, orgTypes: ['EMPLOYER'] },
          update: {},
        })
        await prisma.crmAffiliation.create({ data: { personId, orgId: org.id, title: sug.position || roleTitle } })
        gotTitle = true
      }
    }
    // Same "title + org now both present" bar updatePersonField's title
    // branch already uses to leave the completion queue.
    if (gotTitle || (existing?.orgId && existing.title)) {
      const was = await prisma.crmPerson.findUnique({ where: { id: personId }, select: { needsCompletion: true } })
      await prisma.crmPerson.update({
        where: { id: personId },
        data: completionUpdate(true, was?.needsCompletion ?? true),
      })
    }
  }

  await prisma.crmActivity.create({
    data: { type: 'FIELD_CHANGED', direction: 'INTERNAL', personId, subject: 'roles changed', body: roles.join(', ') || '(none)', loggedByEmail: admin.email ?? null },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_field_edited', { personId, field: 'roles', count: roles.length, surface: 'record' })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
  revalidatePath(`${CRM}/needs-completion`)
}

/**
 * Goal starts out derived from roles (goalsForRoles, see schema comment on
 * CrmPerson.goals) but is a real judgement call, not a fact — someone's BD:
 * Partner role suggests a goal, it doesn't dictate one. Plain overwrite, no
 * side effects like updatePersonRoles' title-filling — the derivation only
 * ever runs once, at role-assignment time.
 */
export async function updatePersonGoals(personId: string, formData: FormData) {
  const admin = await requireAdmin()
  const goals = formData.getAll('goals').map(String) as CrmGoal[]
  await prisma.crmPerson.update({ where: { id: personId }, data: { goals: { set: goals } } })
  captureServerEvent(admin.email ?? 'admin', 'crm_field_edited', { personId, field: 'goals', count: goals.length, surface: 'record' })
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
  // Several types at once: a person is routinely more than one thing, and
  // making you apply them one pass at a time is how the field stays empty.
  const addRoles = formData.getAll('bulkRole').map(String).filter(Boolean) as CrmPersonRole[]
  if (ids.length === 0) return

  const data: { leadQuality?: CrmLeadQuality; warmth?: CrmWarmth } = {}
  if (quality) data.leadQuality = quality as CrmLeadQuality
  if (warmth) data.warmth = warmth as CrmWarmth
  if (Object.keys(data).length > 0) {
    await prisma.crmPerson.updateMany({ where: { id: { in: ids } }, data })
  }
  if (addRoles.length > 0) {
    // Roles are a set: push per row, skipping what each already has.
    const rows = await prisma.crmPerson.findMany({ where: { id: { in: ids } }, select: { id: true, roles: true } })
    await Promise.all(
      rows.map((r) => {
        const missing = addRoles.filter((x) => !r.roles.includes(x))
        return missing.length > 0
          ? prisma.crmPerson.update({ where: { id: r.id }, data: { roles: { push: missing } } })
          : null
      }).filter(Boolean)
    )
  }

  await prisma.crmActivity.createMany({
    data: ids.map((id) => ({
      type: 'FIELD_CHANGED' as const, direction: 'INTERNAL' as const, personId: id,
      subject: 'bulk edit',
      body: [
        quality && `quality→${quality}`,
        warmth && `warmth→${warmth}`,
        addRoles.length > 0 && `+types ${addRoles.join(', ')}`,
      ].filter(Boolean).join(', '),
      loggedByEmail: admin.email ?? null,
    })),
  })

  captureServerEvent(admin.email ?? 'admin', 'crm_bulk_edited', {
    count: ids.length, quality: quality || null, warmth: warmth || null, addedRoles: addRoles,
  })
  revalidatePath(CRM)
}

/**
 * Removes the selected people from every list — a soft delete, not a real
 * one. The row and its history stay (a hard delete would orphan any activity
 * or affiliation pointing at it for no gain), but it stops showing up
 * anywhere, and re-uploading an old export must never resurrect it (see
 * previewImport's 'deleted' action). Confirmed in the UI before it runs and
 * never the default focus, per design-principles.md. Deliberately refuses
 * anyone already converted into a production record — hiding the CRM row for
 * a live coach would just be confusing, not useful.
 */
export async function bulkDeletePeople(formData: FormData): Promise<{ deleted: number; skipped: number }> {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  if (ids.length === 0) return { deleted: 0, skipped: 0 }

  const rows = await prisma.crmPerson.findMany({
    where: { id: { in: ids } },
    select: { id: true, coachId: true, recruiterId: true, candidateId: true },
  })
  const safe = rows.filter((r) => !r.coachId && !r.recruiterId && !r.candidateId).map((r) => r.id)
  const skipped = rows.length - safe.length

  if (safe.length > 0) {
    await prisma.crmPerson.updateMany({ where: { id: { in: safe } }, data: { deletedAt: new Date() } })
  }
  captureServerEvent(admin.email ?? 'admin', 'crm_bulk_deleted', { deleted: safe.length, skipped })
  revalidatePath(CRM)
  return { deleted: safe.length, skipped }
}

/**
 * Resolves a LinkedIn export's raw company text to an organization to
 * affiliate with — a real org when the text names one, otherwise one of two
 * placeholder orgs ("- Unemployed", "- Freelancer") for the export company
 * values common enough to say something real ("Self-employed", "Advisor",
 * "Unemployed"...) rather than dropping that signal on the floor. Genuinely
 * ambiguous text ("Stealth", "Confidential", "Various") resolves to neither
 * — guessing a bucket for those would be worse than leaving it blank.
 */
async function resolveSuggestionOrg(company: string | null): Promise<{ orgId: string | null; placeholderKind: OrgPlaceholderKind | null }> {
  if (isRealOrgName(company)) {
    const key = normalizeOrgName(company)
    if (!key) return { orgId: null, placeholderKind: null }
    const org = await prisma.crmOrganization.upsert({
      where: { canonicalNameNormalized: key },
      create: { name: company, canonicalNameNormalized: key, orgTypes: ['EMPLOYER'] },
      update: {},
    })
    return { orgId: org.id, placeholderKind: null }
  }
  const kind = placeholderOrgKindFor(company)
  if (!kind) return { orgId: null, placeholderKind: null }
  const name = ORG_PLACEHOLDER_NAME[kind]
  const key = normalizeOrgName(name)
  const org = await prisma.crmOrganization.upsert({
    where: { canonicalNameNormalized: key },
    create: { name, canonicalNameNormalized: key, orgTypes: ['EMPLOYER'] },
    update: {},
  })
  return { orgId: org.id, placeholderKind: kind }
}

/**
 * Accepts the LinkedIn-export suggestion for a person missing a title or org.
 * Returns whether anything was actually saved — a row whose suggestion has
 * no usable org and no existing affiliation to hang a title on stays in the
 * queue rather than the caller optimistically hiding a row that didn't
 * actually complete.
 */
export async function acceptExportSuggestion(personId: string): Promise<{ accepted: boolean }> {
  const admin = await requireAdmin()
  const person = await prisma.crmPerson.findUniqueOrThrow({
    where: { id: personId },
    select: {
      id: true, fullName: true, linkedinSlug: true, roles: true, needsCompletion: true,
      affiliations: { select: { id: true } },
    },
  })
  if (!person.linkedinSlug) return { accepted: false }
  const sug = await prisma.crmLinkedInConnection.findUnique({ where: { slug: person.linkedinSlug } })
  if (!sug) return { accepted: false }

  const { orgId, placeholderKind } = await resolveSuggestionOrg(sug.company)
  const existing = person.affiliations[0]
  let saved = false
  if (orgId) {
    if (existing) await prisma.crmAffiliation.update({ where: { id: existing.id }, data: { orgId, title: sug.position ?? '' } })
    else await prisma.crmAffiliation.create({ data: { personId, orgId, title: sug.position ?? '' } })
    saved = true
  } else if (existing && sug.position) {
    // No org to attach it to, but there's already a row to hang the title on.
    await prisma.crmAffiliation.update({ where: { id: existing.id }, data: { title: sug.position } })
    saved = true
  }
  // Otherwise (no org resolved, no existing affiliation) the title has
  // nowhere to live — affiliations require an org — so this one stays in
  // the queue rather than completing with nothing actually recorded.
  if (!saved) return { accepted: false }

  const addJobSeeker = placeholderKind === 'unemployed' && !person.roles.includes('JOB_SEEKER')
  await prisma.crmPerson.update({
    where: { id: personId },
    data: {
      ...completionUpdate(true, person.needsCompletion),
      ...(addJobSeeker ? { roles: [...person.roles, 'JOB_SEEKER' as const] } : {}),
    },
  })

  captureServerEvent(admin.email ?? 'admin', 'crm_completion_accepted', { personId, source: 'linkedin_export' })
  revalidatePath(`${CRM}/needs-completion`)
  return { accepted: true }
}

export interface EmailBackfillResult {
  ok: boolean
  message: string
  /** Set when the address already belongs to someone else. */
  duplicateOf?: { id: string; name: string }
}

/**
 * Saves an address and returns. That is all.
 *
 * Split from the old save-and-search action because the two halves have
 * opposite budgets: writing one column is instant, and searching a mailbox
 * for it is a Google round trip per message. Bundling them made adding an
 * address as slow, and as failure-prone, as the search. The search now lives
 * in /api/admin/crm/check-mail, which the caller fires afterwards and can
 * lose without losing the address.
 */
export async function setPersonEmail(personId: string, rawEmail: string): Promise<EmailBackfillResult> {
  const admin = await requireAdmin()
  const email = normalizeEmail(rawEmail)
  if (!email) return { ok: false, message: 'That doesn’t look like a real email address.' }

  // One address, one person. Checked against live records only — a removed
  // person's old address is free to be given to someone real.
  const owner = await findEmailOwner(email, { excludePersonId: personId })
  if (owner) {
    captureServerEvent(admin.email ?? 'admin', 'crm_duplicate_email_blocked', { personId, ownerId: owner.id, via: 'add_email' })
    return {
      ok: false,
      message: `Already on ${owner.fullName}’s record — one address can only belong to one person.`,
      duplicateOf: { id: owner.id, name: owner.fullName },
    }
  }

  const person = await prisma.crmPerson.findUniqueOrThrow({
    where: { id: personId }, select: { emails: true, priority: true },
  })
  await prisma.crmPerson.update({
    where: { id: personId },
    data: {
      email,
      emails: person.emails.includes(email) ? undefined : { push: email },
      // Same creation-time rule as everywhere else a real email lands on a
      // person — a reachable contact defaults to P2 unless already set.
      priority: person.priority ?? 'P2',
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_email_set', { personId })
  revalidatePath(`${CRM}/needs-completion`)
  revalidatePath(`${CRM}/people/${personId}`)
  revalidatePath(CRM)
  return { ok: true, message: `Saved ${email}.` }
}

// ── Pipelines (Phase 4) ──────────────────────────────────────────────────────

/**
 * Your own addresses that Gmail doesn't list as aliases.
 *
 * Saving also retires any CRM record for one of them — including send-as
 * aliases, which the sweep now treats as you without being told. Those
 * records were never people: they're what the sweep made out of mail
 * forwarded in from your old work and alumni addresses, and they were
 * counting newsletters as correspondence. Soft-deleted, so they're
 * recoverable and, like any deleted record, never re-created by a sweep.
 */
export async function updateSelfEmails(formData: FormData) {
  const admin = await requireAdmin()
  const listed = String(formData.get('selfEmails') ?? '')
    .split(/[\s,;]+/)
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => Boolean(e))
  const unique = [...new Set(listed)]

  await prisma.crmSyncSetting.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', selfEmails: unique, updatedByEmail: admin.email ?? null },
    update: { selfEmails: unique, updatedByEmail: admin.email ?? null },
  })

  const token = await getValidAccessToken().catch(() => null)
  const aliases = token ? await getSendAsAddresses(token) : []
  const retired = await retireSelfRecords([...unique, ...aliases])

  captureServerEvent(admin.email ?? 'admin', 'crm_self_emails_saved', { count: unique.length, retired })
  revalidatePath(`${CRM}/sync`)
  revalidatePath(CRM)
  revalidatePath(`${CRM}/home`)
}

async function retireSelfRecords(addresses: string[]): Promise<number> {
  const set = [...new Set(addresses.map((a) => normalizeEmail(a)).filter((a): a is string => Boolean(a)))]
  if (set.length === 0) return 0
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, OR: [{ email: { in: set } }, { emails: { hasSome: set } }] },
    select: { id: true },
  })
  if (people.length === 0) return 0
  await prisma.crmPerson.updateMany({ where: { id: { in: people.map((p) => p.id) } }, data: { deletedAt: new Date() } })
  return people.length
}

/** Restores removed people — see restorePeople for what is held back and why. */
export async function restoreRemovedPeople(ids: string[]): Promise<RestoreResult> {
  const admin = await requireAdmin()
  const result = await restorePeople(ids.slice(0, 2000))
  captureServerEvent(admin.email ?? 'admin', 'crm_people_restored', {
    requested: ids.length, restored: result.restored.length, skipped: result.skipped.length,
  })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/removed`)
  revalidatePath(`${CRM}/home`)
  return result
}

/**
 * The NextChapter-mention review queue.
 *
 * An outbound email that never mentions NextChapter still gets logged by
 * the sync (it is real outreach), but with needsReview: true — see
 * CrmActivity's own comment. Approving confirms it belongs in the CRM's
 * touch counts and "waiting on a reply"; discarding removes it, same as it
 * never having been logged. Both recompute the person's derived fields,
 * since REAL_TOUCH excludes anything still unreviewed.
 */
export async function approveActivities(ids: string[]): Promise<{ approved: number }> {
  const admin = await requireAdmin()
  const rows = await prisma.crmActivity.findMany({
    where: { id: { in: ids.slice(0, 500) }, needsReview: true },
    select: { id: true, personId: true },
  })
  if (rows.length === 0) return { approved: 0 }
  await prisma.crmActivity.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { needsReview: false, reviewedAt: new Date(), reviewedByEmail: admin.email ?? null },
  })
  await refreshTouchFields([...new Set(rows.map((r) => r.personId).filter((x): x is string => Boolean(x)))])
  captureServerEvent(admin.email ?? 'admin', 'crm_activity_review_approved', { count: rows.length })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/needs-review`)
  revalidatePath(`${CRM}/home`)
  return { approved: rows.length }
}

export async function discardActivities(ids: string[]): Promise<{ discarded: number }> {
  const admin = await requireAdmin()
  const rows = await prisma.crmActivity.findMany({
    where: { id: { in: ids.slice(0, 500) }, needsReview: true },
    select: { id: true, personId: true },
  })
  if (rows.length === 0) return { discarded: 0 }
  await prisma.crmActivity.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  await refreshTouchFields([...new Set(rows.map((r) => r.personId).filter((x): x is string => Boolean(x)))])
  captureServerEvent(admin.email ?? 'admin', 'crm_activity_review_discarded', { count: rows.length })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/needs-review`)
  revalidatePath(`${CRM}/home`)
  return { discarded: rows.length }
}

/**
 * Moves an opportunity between stages.
 *
 * A native <select> rather than drag-and-drop: every interactive element has
 * to be keyboard-accessible per design-principles.md, and a select is that by
 * construction where a drag target needs a parallel keyboard path built and
 * maintained. Drag is a later enhancement on top of this, not a replacement.
 */
export async function moveOpportunityStage(opportunityId: string, stageId: string) {
  const admin = await requireAdmin()
  const opp = await prisma.crmOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    select: { stage: { select: { label: true } }, pipeline: { select: { key: true } } },
  })
  const next = await prisma.crmStage.findUniqueOrThrow({ where: { id: stageId }, select: { label: true, isWon: true, isLost: true } })

  await prisma.crmOpportunity.update({
    where: { id: opportunityId },
    data: {
      stageId,
      outcome: next.isWon ? 'WON' : next.isLost ? 'LOST' : 'OPEN',
      closedAt: next.isWon || next.isLost ? new Date() : null,
    },
  })
  await prisma.crmActivity.create({
    data: {
      type: 'STAGE_CHANGED', direction: 'INTERNAL', opportunityId,
      subject: `${opp.stage.label} → ${next.label}`, loggedByEmail: admin.email ?? null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_stage_changed', {
    opportunityId, pipeline: opp.pipeline.key, from: opp.stage.label, to: next.label,
  })
  revalidatePath(`${CRM}/pipelines/${opp.pipeline.key}`)
  revalidatePath(`${CRM}/leads`)
}

/** Inline edit of an opportunity's next step, dates and grade. */
export async function updateOpportunity(opportunityId: string, formData: FormData) {
  const admin = await requireAdmin()
  const nextStep = String(formData.get('nextStep') ?? '').trim() || null
  const nextStepDueAt = String(formData.get('nextStepDueAt') ?? '').trim()
  const committedFollowUpAt = String(formData.get('committedFollowUpAt') ?? '').trim()
  const committedTo = String(formData.get('committedTo') ?? '').trim() || null
  const leadQuality = String(formData.get('leadQuality') ?? '').trim()
  const overrideRaw = String(formData.get('priorityOverride') ?? '').trim()

  const opp = await prisma.crmOpportunity.update({
    where: { id: opportunityId },
    data: {
      nextStep,
      nextStepDueAt: nextStepDueAt ? new Date(nextStepDueAt) : null,
      committedFollowUpAt: committedFollowUpAt ? new Date(committedFollowUpAt) : null,
      committedTo,
      ...(leadQuality ? { leadQuality: leadQuality as CrmLeadQuality } : {}),
      priorityOverride: overrideRaw ? Math.max(0, Math.min(100, parseInt(overrideRaw, 10) || 0)) : null,
    },
    select: { pipeline: { select: { key: true } } },
  })

  captureServerEvent(admin.email ?? 'admin', 'crm_opportunity_edited', {
    opportunityId, hasCommitment: Boolean(committedFollowUpAt), hasOverride: Boolean(overrideRaw),
  })
  revalidatePath(`${CRM}/pipelines/${opp.pipeline.key}`)
  revalidatePath(`${CRM}/leads`)
}

// ── Date refresh (Phase 5) ───────────────────────────────────────────────────


/** Results are reused for a day rather than re-fetching the same page. */
const CHECK_CACHE_MS = 24 * 60 * 60 * 1000

export interface DateCheckResult {
  ok: boolean
  message: string
  checkId?: string
  cached?: boolean
  candidates?: { iso: string; label: string; snippet: string; confidence: number }[]
}

/**
 * Fetches a deadline's source page and offers candidate dates.
 *
 * NEVER writes the date itself — you confirm or dismiss. Every run writes a
 * CrmDeadlineCheck so a wrong answer is traceable and the same page isn't
 * fetched repeatedly.
 *
 * Model-free by design: a page fetch costs nothing per use, so this feature is
 * not metered. The heuristic finds candidates and shows the sentence each came
 * from; the judgement stays human.
 */
export async function checkDeadlineForNewDate(deadlineId: string): Promise<DateCheckResult> {
  const admin = await requireAdmin()
  const deadline = await prisma.crmDeadline.findUniqueOrThrow({
    where: { id: deadlineId },
    select: { id: true, sourceUrl: true, lastCheckedAt: true, org: { select: { website: true } } },
  })

  const url = deadline.sourceUrl ?? deadline.org?.website ?? null
  if (!url) {
    return { ok: false, message: 'No source link on this record, so there is nothing to check. Add one on the organization page.' }
  }

  // Reuse a recent result rather than hitting the same page again.
  if (deadline.lastCheckedAt && Date.now() - deadline.lastCheckedAt.getTime() < CHECK_CACHE_MS) {
    const recent = await prisma.crmDeadlineCheck.findFirst({
      where: { deadlineId, confirmedAt: null },
      orderBy: { checkedAt: 'desc' },
    })
    if (recent) {
      return {
        ok: true, cached: true, checkId: recent.id,
        message: `Checked ${recent.checkedAt.toLocaleString()} — showing that result. It will re-fetch after 24 hours.`,
        candidates: recent.foundDate
          ? [{ iso: recent.foundDate.toISOString().slice(0, 10), label: recent.foundDate.toLocaleDateString(), snippet: recent.rawSnippet ?? '', confidence: 1 }]
          : [],
      }
    }
  }

  let parsed: URL
  try { parsed = new URL(url) } catch { return { ok: false, message: `That source link isn't a valid URL: ${url}` } }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, message: 'Only http and https links can be checked.' }
  }
  // These URLs are admin-entered rather than user-supplied, but a fetch from
  // the server to an internal address is worth refusing regardless.
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[?::1)/i.test(parsed.hostname)) {
    return { ok: false, message: 'That link points at an internal address, so it will not be fetched.' }
  }

  let text: string
  try {
    const res = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'NextChapterAdmin/1.0 (deadline check)' },
    })
    if (!res.ok) {
      await prisma.crmDeadline.update({ where: { id: deadlineId }, data: { lastCheckedAt: new Date() } })
      return { ok: false, message: `That page returned ${res.status}. The program may have moved or been taken down.` }
    }
    const body = await res.text()
    text = htmlToText(body.slice(0, 1_500_000))
  } catch (e) {
    await prisma.crmDeadline.update({ where: { id: deadlineId }, data: { lastCheckedAt: new Date() } })
    const reason = e instanceof Error && e.name === 'TimeoutError' ? 'took too long to respond' : 'could not be reached'
    return { ok: false, message: `That page ${reason}. Try again later, or open it yourself.` }
  }

  const candidates = extractDateCandidates(text)
  const best = candidates[0] ?? null

  const check = await prisma.crmDeadlineCheck.create({
    data: {
      deadlineId, checkedByEmail: admin.email ?? null, fetchedUrl: parsed.toString(),
      foundDate: best?.date ?? null, rawSnippet: best?.snippet ?? null,
    },
  })
  await prisma.crmDeadline.update({ where: { id: deadlineId }, data: { lastCheckedAt: new Date() } })

  captureServerEvent(admin.email ?? 'admin', 'crm_deadline_checked', {
    deadlineId, found: candidates.length, topConfidence: best?.confidence ?? null,
  })
  revalidatePath(`${CRM}/dates`)

  return {
    ok: true,
    checkId: check.id,
    message: candidates.length === 0
      ? 'No dates found on that page. It may be genuinely rolling, or the date may be behind a form.'
      : `Found ${candidates.length} possible ${candidates.length === 1 ? 'date' : 'dates'}. Nothing has been saved — pick one or dismiss.`,
    candidates: candidates.slice(0, 6).map((c) => ({
      iso: c.date.toISOString().slice(0, 10),
      label: c.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      snippet: c.snippet,
      confidence: c.confidence,
    })),
  }
}

/** Applies a date you chose from a check, or records that you dismissed it. */
export async function confirmDeadlineDate(formData: FormData) {
  const admin = await requireAdmin()
  const deadlineId = String(formData.get('deadlineId') ?? '')
  const checkId = String(formData.get('checkId') ?? '')
  // A picked candidate wins over the manual field; the manual field is the
  // fallback for the common case where the page publishes no date at all.
  const iso = (String(formData.get('chosen') ?? '').trim() || String(formData.get('chosenManual') ?? '').trim())

  if (iso) {
    await prisma.crmDeadline.update({
      where: { id: deadlineId },
      data: { dueAt: new Date(`${iso}T00:00:00Z`), rawText: null, kind: 'APPLICATION_CLOSE' },
    })
  }
  if (checkId) {
    await prisma.crmDeadlineCheck.update({
      where: { id: checkId },
      data: { confirmedAt: new Date(), confirmedByEmail: admin.email ?? null, wasAccepted: Boolean(iso) },
    })
  }
  captureServerEvent(admin.email ?? 'admin', 'crm_deadline_check_resolved', { deadlineId, accepted: Boolean(iso) })
  revalidatePath(`${CRM}/dates`)
  revalidatePath(`${CRM}/queue`)
}

// ── Intro paths and research stance (Phase 6) ────────────────────────────────

/**
 * Records a route to someone you have no direct line to.
 *
 * A target can carry several stacked paths, which the source sheets could not
 * express — they held a single free-text "Warm Path" column with one guess
 * that couldn't be searched, updated, or marked as already asked.
 *
 * A connector is either a real person in the Ecosystem (searchable across all 3,688)
 * or free text, for a route you've heard about but can't yet name.
 */
export async function addIntroPath(
  target: { personId?: string; orgId?: string },
  formData: FormData
) {
  const admin = await requireAdmin()
  const connectorPersonId = String(formData.get('connectorPersonId') ?? '').trim() || null
  const connectorName = String(formData.get('connectorName') ?? '').trim() || null
  const relationshipNote = String(formData.get('relationshipNote') ?? '').trim() || null
  const strength = String(formData.get('strength') ?? 'UNVERIFIED') as CrmIntroPathStrength

  if (!connectorPersonId && !connectorName) return
  if (!target.personId && !target.orgId) return

  await prisma.crmIntroPath.create({
    data: {
      targetPersonId: target.personId ?? null,
      targetOrgId: target.personId ? null : (target.orgId ?? null),
      connectorPersonId, connectorName, relationshipNote, strength,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_intro_path_added', {
    targetType: target.personId ? 'person' : 'organization',
    viaRecord: Boolean(connectorPersonId), strength,
  })
  if (target.personId) revalidatePath(`${CRM}/people/${target.personId}`)
  if (target.orgId) revalidatePath(`${CRM}/organizations/${target.orgId}`)
}

/** Moves a path along: identified → asked → intro made, or declined. */
export async function updateIntroPathStatus(pathId: string, status: CrmIntroPathStatus) {
  const admin = await requireAdmin()
  const path = await prisma.crmIntroPath.update({
    where: { id: pathId },
    data: { status, askedAt: status === 'ASKED' ? new Date() : undefined },
    select: { targetPersonId: true, targetOrgId: true },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_intro_path_status_changed', { pathId, status })
  if (path.targetPersonId) revalidatePath(`${CRM}/people/${path.targetPersonId}`)
  if (path.targetOrgId) revalidatePath(`${CRM}/organizations/${path.targetOrgId}`)
}

export async function deleteIntroPath(pathId: string) {
  const admin = await requireAdmin()
  const path = await prisma.crmIntroPath.delete({ where: { id: pathId }, select: { targetPersonId: true, targetOrgId: true } })
  captureServerEvent(admin.email ?? 'admin', 'crm_intro_path_deleted', { pathId })
  if (path.targetPersonId) revalidatePath(`${CRM}/people/${path.targetPersonId}`)
  if (path.targetOrgId) revalidatePath(`${CRM}/organizations/${path.targetOrgId}`)
}

/**
 * Sets where a piece of research sits relative to the NextChapter thesis.
 *
 * Always a human judgement. A researcher whose findings argue displacement is
 * overstated is a RISK in a pitch meeting, not an asset, and inferring that
 * automatically is a way to walk in confidently wrong.
 */
export async function setResearchStance(itemId: string, stance: CrmResearchStance) {
  const admin = await requireAdmin()
  await prisma.crmResearchItem.update({ where: { id: itemId }, data: { stance } })
  captureServerEvent(admin.email ?? 'admin', 'crm_research_stance_set', { itemId, stance })
  revalidatePath(`${CRM}/research`)
}

export async function updateResearchItem(itemId: string, formData: FormData) {
  const admin = await requireAdmin()
  const keyClaim = String(formData.get('keyClaim') ?? '').trim() || null
  const relevanceNote = String(formData.get('relevanceNote') ?? '').trim() || null
  const useInPitch = formData.get('useInPitch') === 'on'
  const stanceRaw = String(formData.get('stance') ?? '').trim()

  await prisma.crmResearchItem.update({
    where: { id: itemId },
    data: {
      keyClaim, relevanceNote, useInPitch,
      ...(stanceRaw ? { stance: stanceRaw as CrmResearchStance } : {}),
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_research_item_edited', { itemId, useInPitch })
  revalidatePath(`${CRM}/research`)
}


// ── Graduation (Phase 9) ─────────────────────────────────────────────────────

export interface GraduationResult { ok: boolean; message: string; href?: string }

/**
 * Converts a won CRM record into the real production entity.
 *
 * The CRM owns everything BEFORE conversion; Coach, Recruiter,
 * OutplacementEmployerOrg and CandidateProfile own everything after. This is
 * the join — a nullable foreign key, not a copy. The CRM record keeps its full
 * pre-conversion history (every email, every intro path, every stage change),
 * which is precisely what would be lost if conversion meant re-typing someone
 * into a second system.
 *
 * Idempotent: a person already linked returns their existing record rather
 * than creating a duplicate.
 */
export async function graduatePerson(
  personId: string,
  target: 'COACH' | 'RECRUITER'
): Promise<GraduationResult> {
  const admin = await requireAdmin()
  const person = await prisma.crmPerson.findUniqueOrThrow({
    where: { id: personId },
    include: { affiliations: { where: { isPrimary: true }, take: 1, include: { org: true } } },
  })

  if (target === 'COACH' && person.coachId) {
    return { ok: true, message: 'Already a coach.', href: `/support/admin/coaches/${person.coachId}` }
  }
  if (target === 'RECRUITER' && person.recruiterId) {
    return { ok: true, message: 'Already a recruiter.', href: `/support/admin/recruiters/${person.recruiterId}` }
  }
  if (!person.email) {
    return { ok: false, message: 'A work email is required before converting. Add one on this record first.' }
  }

  const firmName = person.affiliations[0]?.org.name ?? null

  if (target === 'COACH') {
    // workEmail is unique — an existing row is the same human, so link rather
    // than fail on a constraint the user cannot see.
    const existing = await prisma.coach.findUnique({ where: { workEmail: person.email } })
    const coach = existing ?? await prisma.coach.create({
      // CAREER is the default focus; the coach record is editable afterwards.
      data: { fullName: person.fullName, workEmail: person.email, firmName, focus: 'CAREER' },
    })
    await prisma.crmPerson.update({ where: { id: personId }, data: { coachId: coach.id } })
    await prisma.crmActivity.create({
      data: {
        type: 'FIELD_CHANGED', direction: 'INTERNAL', personId,
        subject: 'Converted to coach', body: existing ? 'Linked to an existing coach record' : 'Created a coach record',
        loggedByEmail: admin.email ?? null,
      },
    })
    captureServerEvent(admin.email ?? 'admin', 'crm_person_graduated', { personId, target, reused: Boolean(existing) })
    revalidatePath(`${CRM}/people/${personId}`)
    return {
      ok: true,
      message: existing ? `Linked to the existing coach record for ${person.fullName}.` : `${person.fullName} is now a coach.`,
      href: `/support/admin/coaches/${coach.id}`,
    }
  }

  const existing = await prisma.recruiter.findUnique({ where: { workEmail: person.email } })
  const recruiter = existing ?? await prisma.recruiter.create({
    data: { fullName: person.fullName, workEmail: person.email, firmName },
  })
  await prisma.crmPerson.update({ where: { id: personId }, data: { recruiterId: recruiter.id } })
  await prisma.crmActivity.create({
    data: {
      type: 'FIELD_CHANGED', direction: 'INTERNAL', personId,
      subject: 'Converted to recruiter', body: existing ? 'Linked to an existing recruiter record' : 'Created a recruiter record',
      loggedByEmail: admin.email ?? null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_person_graduated', { personId, target, reused: Boolean(existing) })
  revalidatePath(`${CRM}/people/${personId}`)
  return {
    ok: true,
    message: existing ? `Linked to the existing recruiter record for ${person.fullName}.` : `${person.fullName} is now a recruiter.`,
    href: `/support/admin/recruiters/${recruiter.id}`,
  }
}

/** Converts a won outplacement organization into a real employer org. */
export async function graduateOrganization(orgId: string): Promise<GraduationResult> {
  const admin = await requireAdmin()
  const org = await prisma.crmOrganization.findUniqueOrThrow({
    where: { id: orgId },
    include: {
      affiliations: {
        where: { person: { email: { not: null } } },
        take: 1,
        include: { person: { select: { fullName: true, email: true } } },
      },
    },
  })
  if (org.outplacementOrgId) {
    return { ok: true, message: 'Already an outplacement employer.', href: '/support/admin/outplacement-contracts' }
  }

  const contact = org.affiliations[0]?.person
  if (!contact?.email) {
    return {
      ok: false,
      message: 'An outplacement employer needs a primary contact with an email. Add one to this organization first.',
    }
  }

  const employer = await prisma.outplacementEmployerOrg.create({
    data: { name: org.name, primaryContactName: contact.fullName, primaryContactEmail: contact.email },
  })
  await prisma.crmOrganization.update({ where: { id: orgId }, data: { outplacementOrgId: employer.id } })
  captureServerEvent(admin.email ?? 'admin', 'crm_organization_graduated', { orgId, employerId: employer.id })
  revalidatePath(`${CRM}/organizations/${orgId}`)
  return { ok: true, message: `${org.name} is now an outplacement employer.`, href: '/support/admin/outplacement-contracts' }
}

/** Sets how often the sweeps run, and whether they run at all. */
export async function updateSyncSetting(formData: FormData) {
  const admin = await requireAdmin()
  const hours = parseInt(String(formData.get('intervalHours') ?? '24'), 10)
  const allowed = [1, 24, 168]
  await prisma.crmSyncSetting.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      intervalHours: allowed.includes(hours) ? hours : 24,
      enabled: formData.get('enabled') === 'on',
      updatedByEmail: admin.email ?? null,
    },
    update: {
      intervalHours: allowed.includes(hours) ? hours : 24,
      enabled: formData.get('enabled') === 'on',
      updatedByEmail: admin.email ?? null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_sync_setting_changed', { intervalHours: hours })
  revalidatePath(`${CRM}/sync`)
}

/**
 * Disconnects the admin Gmail inbox — same GoogleInboxConnection row Market
 * Pulse's research-inbox sweep also reads, so this affects both features.
 * Revalidates both admin pages for that reason.
 */
export async function disconnectAdminGmailInbox() {
  const admin = await requireAdmin()
  await prisma.googleInboxConnection.deleteMany({})
  captureServerEvent(admin.email ?? 'admin', 'google_inbox_disconnected', { surface: 'crm_sync' })
  revalidatePath(`${CRM}/sync`)
  revalidatePath('/support/admin/digest')
}

// ── Deal stages ──────────────────────────────────────────────────────────────

/** Renames a stage. The key stays fixed so nothing that references it breaks. */
export async function renameStage(stageId: string, formData: FormData) {
  const admin = await requireAdmin()
  const label = String(formData.get('label') ?? '').trim()
  if (!label) return
  const stage = await prisma.crmStage.update({
    where: { id: stageId }, data: { label },
    select: { pipeline: { select: { key: true } } },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_stage_renamed', { stageId, label })
  revalidatePath(`${CRM}/pipelines/${stage.pipeline.key}`)
  revalidatePath(`${CRM}/pipelines`)
}

/** Moves a stage one position. Swaps sortOrder with its neighbour. */
export async function moveStage(stageId: string, direction: 'up' | 'down') {
  const admin = await requireAdmin()
  const stage = await prisma.crmStage.findUniqueOrThrow({
    where: { id: stageId },
    select: { id: true, sortOrder: true, pipelineId: true, pipeline: { select: { key: true } } },
  })
  const neighbour = await prisma.crmStage.findFirst({
    where: {
      pipelineId: stage.pipelineId,
      sortOrder: direction === 'up' ? { lt: stage.sortOrder } : { gt: stage.sortOrder },
    },
    orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
    select: { id: true, sortOrder: true },
  })
  if (!neighbour) return

  // Two updates, not one: sortOrder has no unique constraint, so a straight
  // swap is safe and avoids a temporary value nobody would ever see.
  await prisma.$transaction([
    prisma.crmStage.update({ where: { id: stage.id }, data: { sortOrder: neighbour.sortOrder } }),
    prisma.crmStage.update({ where: { id: neighbour.id }, data: { sortOrder: stage.sortOrder } }),
  ])
  captureServerEvent(admin.email ?? 'admin', 'crm_stage_moved', { stageId, direction })
  revalidatePath(`${CRM}/pipelines/${stage.pipeline.key}`)
}

/** Adds a stage before the won/lost stages, where new work actually belongs. */
export async function addStage(pipelineId: string, formData: FormData) {
  const admin = await requireAdmin()
  const label = String(formData.get('label') ?? '').trim()
  if (!label) return

  const pipeline = await prisma.crmPipeline.findUniqueOrThrow({
    where: { id: pipelineId },
    select: { key: true, stages: { orderBy: { sortOrder: 'asc' } } },
  })
  // A new stage almost never belongs after "Won" — insert it before the
  // terminal stages and shift those along.
  const firstTerminal = pipeline.stages.find((s) => s.isWon || s.isLost)
  const at = firstTerminal ? firstTerminal.sortOrder : pipeline.stages.length

  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
  if (pipeline.stages.some((s) => s.key === key)) return

  await prisma.$transaction([
    ...pipeline.stages
      .filter((s) => s.sortOrder >= at)
      .map((s) => prisma.crmStage.update({ where: { id: s.id }, data: { sortOrder: s.sortOrder + 1 } })),
    prisma.crmStage.create({ data: { pipelineId, key, label, sortOrder: at } }),
  ])
  captureServerEvent(admin.email ?? 'admin', 'crm_stage_added', { pipelineId, label })
  revalidatePath(`${CRM}/pipelines/${pipeline.key}`)
}

export interface StageDeleteResult { ok: boolean; message: string }

/**
 * Removes a stage.
 *
 * Refuses while anything sits in it. Deleting a stage with opportunities would
 * either orphan them or silently move them somewhere you did not choose, and
 * both are worse than being told to move them first.
 */
export async function deleteStage(stageId: string): Promise<StageDeleteResult> {
  const admin = await requireAdmin()
  const stage = await prisma.crmStage.findUniqueOrThrow({
    where: { id: stageId },
    select: {
      id: true, label: true, isWon: true, isLost: true, pipelineId: true,
      pipeline: { select: { key: true } },
      _count: { select: { opportunities: true } },
    },
  })

  if (stage._count.opportunities > 0) {
    return {
      ok: false,
      message: `${stage._count.opportunities} ${stage._count.opportunities === 1 ? 'deal is' : 'deals are'} in “${stage.label}”. Move them first, then remove it.`,
    }
  }
  const remaining = await prisma.crmStage.count({ where: { pipelineId: stage.pipelineId } })
  if (remaining <= 2) {
    return { ok: false, message: 'A pipeline needs at least two stages.' }
  }

  await prisma.crmStage.delete({ where: { id: stageId } })
  captureServerEvent(admin.email ?? 'admin', 'crm_stage_deleted', { stageId })
  revalidatePath(`${CRM}/pipelines/${stage.pipeline.key}`)
  return { ok: true, message: `Removed “${stage.label}”.` }
}

/** Marks which stage counts as won, or as lost. Exactly one won per pipeline. */
export async function setStageOutcome(stageId: string, outcome: 'won' | 'lost' | 'open') {
  const admin = await requireAdmin()
  const stage = await prisma.crmStage.findUniqueOrThrow({
    where: { id: stageId }, select: { pipelineId: true, pipeline: { select: { key: true } } },
  })
  if (outcome === 'won') {
    // Two "won" stages would make every win figure ambiguous.
    await prisma.crmStage.updateMany({ where: { pipelineId: stage.pipelineId }, data: { isWon: false } })
  }
  await prisma.crmStage.update({
    where: { id: stageId },
    data: { isWon: outcome === 'won', isLost: outcome === 'lost' },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_stage_outcome_set', { stageId, outcome })
  revalidatePath(`${CRM}/pipelines/${stage.pipeline.key}`)
}

/**
 * Records a program's own deadline from the lead row.
 *
 * Accepts dates in the PAST on purpose — "the AI Futures Fund closed on 30
 * August" is exactly the fact worth capturing, and refusing it would leave the
 * record saying nothing when it should say "this one has been and gone".
 * A past date lands in the passed-dates list where the refresh check lives.
 */
export async function setOpportunityDeadline(opportunityId: string, formData: FormData) {
  const admin = await requireAdmin()
  const iso = String(formData.get('deadlineDate') ?? '').trim()
  const label = String(formData.get('deadlineLabel') ?? '').trim() || 'Deadline'

  const opp = await prisma.crmOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    select: { orgId: true, pipeline: { select: { key: true } }, org: { select: { website: true } } },
  })
  if (!opp.orgId) return

  if (!iso) {
    await prisma.crmDeadline.deleteMany({ where: { orgId: opp.orgId, label } })
  } else {
    const dueAt = new Date(`${iso}T00:00:00Z`)
    const existing = await prisma.crmDeadline.findFirst({ where: { orgId: opp.orgId, label } })
    if (existing) {
      await prisma.crmDeadline.update({
        where: { id: existing.id },
        data: { dueAt, rawText: null, kind: 'APPLICATION_CLOSE' },
      })
    } else {
      await prisma.crmDeadline.create({
        data: {
          orgId: opp.orgId, label, dueAt, kind: 'APPLICATION_CLOSE',
          sourceUrl: opp.org?.website ?? null,
        },
      })
    }
  }

  captureServerEvent(admin.email ?? 'admin', 'crm_deadline_set_from_lead', {
    opportunityId, cleared: !iso, inPast: iso ? new Date(`${iso}T00:00:00Z`) < new Date() : false,
  })
  revalidatePath(`${CRM}/leads`)
  revalidatePath(`${CRM}/dates`)
  revalidatePath(`${CRM}/pipelines/${opp.pipeline.key}`)
}

/** Investor-profile fields edited from the lead row. */
export async function updateFunderFacts(orgId: string, formData: FormData) {
  const admin = await requireAdmin()
  const kind = String(formData.get('funderKind') ?? '').trim()
  const valueTypes = formData.getAll('valueTypes').map(String) as CrmValueType[]
  const preconditions = String(formData.get('preconditions') ?? '').trim() || null
  const leadRaw = String(formData.get('preconditionLeadTimeDays') ?? '').trim()

  await prisma.crmInvestorProfile.upsert({
    where: { orgId },
    create: {
      orgId,
      funderKind: kind ? (kind as CrmFunderKind) : null,
      valueTypes, preconditions,
      preconditionLeadTimeDays: leadRaw ? Math.max(0, parseInt(leadRaw, 10) || 0) : null,
    },
    update: {
      funderKind: kind ? (kind as CrmFunderKind) : null,
      valueTypes: { set: valueTypes },
      preconditions,
      preconditionLeadTimeDays: leadRaw ? Math.max(0, parseInt(leadRaw, 10) || 0) : null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_funder_facts_edited', { orgId, kind: kind || null, valueTypes })
  revalidatePath(`${CRM}/leads`)
}

/** Sets (or clears) a person's priority tier. A decision, not a computation. */
export async function setPersonPriority(personId: string, tier: CrmPriorityTier | null) {
  const admin = await requireAdmin()
  await prisma.crmPerson.update({ where: { id: personId }, data: { priority: tier } })
  captureServerEvent(admin.email ?? 'admin', 'crm_person_priority_set', { personId, tier })
  revalidatePath(CRM)
}

/**
 * Logs that you contacted someone, asking how and when.
 *
 * The column used to be a passive "Last contacted" readout, which meant the
 * only way to correct it was through a record page — so it stayed wrong.
 * Recording the channel matters because LinkedIn can never log itself, and
 * recording the date matters because you log things days after they happen.
 */
export async function logContact(personId: string, formData: FormData) {
  const admin = await requireAdmin()
  const { type } = await logManualContact({
    personId,
    channel: String(formData.get('channel') ?? 'EMAIL'),
    date: String(formData.get('occurredAt') ?? ''),
    note: String(formData.get('note') ?? ''),
    direction: formData.get('direction') === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
    loggedByEmail: admin.email ?? null,
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_activity_logged', { personId, type, auto: false, surface: 'list', direction: String(formData.get('direction') ?? 'OUTBOUND') })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
  revalidatePath(`${CRM}/home`)
}

// ── Bulk actions on organizations and leads ──────────────────────────────────

/** Adds org types and goals to several organizations at once. */
export async function bulkUpdateOrganizations(formData: FormData) {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  if (ids.length === 0) return
  const addTypes = formData.getAll('bulkOrgType').map(String).filter(Boolean) as CrmOrgType[]
  const addGoals = formData.getAll('bulkGoal').map(String).filter(Boolean) as CrmGoal[]
  const state = String(formData.get('bulkState') ?? '').trim()

  if (addTypes.length > 0 || addGoals.length > 0) {
    // Arrays are sets: push per row, skipping what each already has.
    const rows = await prisma.crmOrganization.findMany({
      where: { id: { in: ids } }, select: { id: true, orgTypes: true, goals: true },
    })
    await Promise.all(rows.map((r) => {
      const types = addTypes.filter((t) => !r.orgTypes.includes(t))
      const goals = addGoals.filter((g) => !r.goals.includes(g))
      if (types.length === 0 && goals.length === 0) return null
      return prisma.crmOrganization.update({
        where: { id: r.id },
        data: {
          ...(types.length > 0 ? { orgTypes: { push: types } } : {}),
          ...(goals.length > 0 ? { goals: { push: goals } } : {}),
        },
      })
    }).filter(Boolean))
  }
  if (state) {
    await prisma.crmOrganization.updateMany({ where: { id: { in: ids } }, data: { usState: state } })
  }

  captureServerEvent(admin.email ?? 'admin', 'crm_bulk_orgs_edited', {
    count: ids.length, addedTypes: addTypes, addedGoals: addGoals, state: state || null,
  })
  revalidatePath(`${CRM}/organizations`)
}

/**
 * Deletes organizations.
 *
 * Refuses any that still hold people, opportunities or a production link.
 * Deleting an organization cascades to its affiliations and opportunities,
 * which would silently take real work with it — being told to clear it first
 * is better than discovering that later.
 */
export async function bulkDeleteOrganizations(formData: FormData): Promise<{ deleted: number; skipped: number }> {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  if (ids.length === 0) return { deleted: 0, skipped: 0 }

  const rows = await prisma.crmOrganization.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, outplacementOrgId: true, recruiterFirmId: true,
      _count: { select: { affiliations: true, opportunities: true } },
    },
  })
  const safe = rows
    .filter((r) => r._count.affiliations === 0 && r._count.opportunities === 0 && !r.outplacementOrgId && !r.recruiterFirmId)
    .map((r) => r.id)

  if (safe.length > 0) await prisma.crmOrganization.deleteMany({ where: { id: { in: safe } } })
  captureServerEvent(admin.email ?? 'admin', 'crm_bulk_orgs_deleted', { deleted: safe.length, skipped: rows.length - safe.length })
  revalidatePath(`${CRM}/organizations`)
  return { deleted: safe.length, skipped: rows.length - safe.length }
}

/** Moves, grades or closes several leads at once. */
export async function bulkUpdateOpportunities(formData: FormData): Promise<{ updated: number; skipped: number }> {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  if (ids.length === 0) return { updated: 0, skipped: 0 }

  const quality = String(formData.get('bulkQuality') ?? '').trim()
  const eligibility = String(formData.get('bulkEligibility') ?? '').trim()
  const stageKey = String(formData.get('bulkStageKey') ?? '').trim()
  const close = String(formData.get('bulkClose') ?? '').trim()

  const data: Prisma.CrmOpportunityUpdateManyMutationInput = {}
  if (quality) data.leadQuality = quality as CrmLeadQuality
  if (eligibility) data.eligibility = eligibility as CrmEligibility
  if (close === 'LOST' || close === 'DORMANT') {
    data.outcome = close as CrmOpportunityOutcome
    data.closedAt = new Date()
  }
  let updated = 0
  if (Object.keys(data).length > 0) {
    updated = (await prisma.crmOpportunity.updateMany({ where: { id: { in: ids } }, data })).count
  }

  let skipped = 0
  if (stageKey) {
    // Stage ids are per-pipeline, so a stage can only be applied to leads in
    // the pipeline that owns it. Anything in another pipeline is skipped and
    // reported rather than quietly left where it was.
    const rows = await prisma.crmOpportunity.findMany({
      where: { id: { in: ids } }, select: { id: true, pipelineId: true },
    })
    const stages = await prisma.crmStage.findMany({
      where: { key: stageKey, pipelineId: { in: [...new Set(rows.map((r) => r.pipelineId))] } },
      select: { id: true, pipelineId: true },
    })
    const byPipeline = new Map(stages.map((s) => [s.pipelineId, s.id]))
    for (const r of rows) {
      const stageId = byPipeline.get(r.pipelineId)
      if (!stageId) { skipped++; continue }
      await prisma.crmOpportunity.update({ where: { id: r.id }, data: { stageId } })
      updated++
    }
  }

  captureServerEvent(admin.email ?? 'admin', 'crm_bulk_leads_edited', {
    count: ids.length, quality: quality || null, stageKey: stageKey || null, close: close || null, skipped,
  })
  revalidatePath(`${CRM}/leads`)
  return { updated, skipped }
}

/**
 * Adds a piece of research, with authors and optionally an uploaded PDF.
 *
 * Authors are stored as text AND matched to Ecosystem people, because a
 * researcher is someone you may end up meeting — the name on a paper and the
 * person in your CRM should be the same record. A name that matches nobody is
 * created as a person with the ACADEMIC role rather than being dropped: the
 * whole point of recording an author is that they become reachable.
 */
export async function addResearchItem(_prev: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { ok: false, message: 'A title is needed.' }

  const url = String(formData.get('url') ?? '').trim() || null
  const orgName = String(formData.get('orgName') ?? '').trim()
  const keyClaim = String(formData.get('keyClaim') ?? '').trim() || null
  const yearRaw = String(formData.get('publishedYear') ?? '').trim()
  const stance = String(formData.get('stance') ?? 'UNSET') as CrmResearchStance
  const authorsRaw = String(formData.get('authorNames') ?? '').trim()
  const file = formData.get('file')

  let fileUrl: string | null = null
  let fileName: string | null = null
  if (file instanceof File && file.size > 0) {
    if (file.type !== 'application/pdf') {
      return { ok: false, message: 'Only PDFs can be uploaded. Paste a link for anything else.' }
    }
    if (file.size > 25_000_000) {
      return { ok: false, message: 'That PDF is over 25 MB. Link to it instead.' }
    }
    const { createClient } = await import('@supabase/supabase-js')
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
    const path = `${Date.now()}-${safe}`
    const { error } = await storage.storage.from('research-files').upload(path, file, { contentType: 'application/pdf' })
    if (error) return { ok: false, message: `Upload failed: ${error.message}` }
    fileUrl = storage.storage.from('research-files').getPublicUrl(path).data.publicUrl
    fileName = file.name
  }

  if (!url && !fileUrl) {
    return { ok: false, message: 'Give it a link or upload the PDF — a claim with no source cannot be checked later.' }
  }

  let orgId: string | null = null
  if (isRealOrgName(orgName)) {
    const key = normalizeOrgName(orgName)
    if (key) {
      const org = await prisma.crmOrganization.upsert({
        where: { canonicalNameNormalized: key },
        create: { name: orgName, canonicalNameNormalized: key, orgTypes: ['THINK_TANK'] },
        update: {},
      })
      orgId = org.id
    }
  }

  const item = await prisma.crmResearchItem.create({
    data: {
      title, url, fileUrl, fileName, orgId, keyClaim, stance,
      authorNames: authorsRaw || null,
      publishedYear: yearRaw ? parseInt(yearRaw, 10) || null : null,
      relevanceNote: String(formData.get('relevanceNote') ?? '').trim() || null,
    },
  })

  // Authors become people — matched where they exist, created where they don't.
  let linked = 0
  let created = 0
  for (const raw of authorsRaw.split(/[,;]| and /).map((n) => n.trim()).filter(Boolean).slice(0, 12)) {
    const name = cleanAuthorName(raw)
    if (!name) continue
    let person = await prisma.crmPerson.findFirst({ where: { fullName: { equals: name, mode: 'insensitive' } } })
    if (!person) {
      person = await prisma.crmPerson.create({
        data: {
          fullName: name,
          firstName: name.split(' ')[0] ?? null,
          lastName: name.split(' ').slice(1).join(' ') || null,
          roles: ['POLICY_ANALYST'], goals: ['ADVISORY_RECRUITING'],
          needsCompletion: true,
        },
      })
      created++
    } else linked++
    await prisma.crmResearchAuthor.upsert({
      where: { itemId_personId: { itemId: item.id, personId: person.id } },
      create: { itemId: item.id, personId: person.id },
      update: {},
    })
  }

  captureServerEvent(admin.email ?? 'admin', 'crm_research_added', {
    itemId: item.id, hasFile: Boolean(fileUrl), authorsLinked: linked, authorsCreated: created,
  })
  revalidatePath(`${CRM}/research`)
  const authorNote = linked + created > 0
    ? ` ${linked + created} ${linked + created === 1 ? 'author' : 'authors'} recorded${created > 0 ? `, ${created} added as new people` : ''}.`
    : ''
  return { ok: true, message: `Saved “${title}”.${authorNote}` }
}

/** Strips titles and trailing affiliations from an author name. */
function cleanAuthorName(raw: string): string | null {
  let n = raw.replace(/\(.*?\)/g, ' ').replace(/\b(Dr|Prof|Professor|PhD|Ph\.D\.?|MD)\.?\b/gi, ' ')
  n = n.replace(/\s+/g, ' ').trim()
  // A single word is an initial or a fragment, not a person we can find again.
  return n.split(' ').length >= 2 ? n : null
}

/**
 * Completion queue, in bulk.
 *
 * 187 rows reviewed one button at a time is a queue nobody finishes. One
 * "Approve" action for the whole selection: apply the export suggestion
 * where one exists (safe precisely because it's your own LinkedIn data
 * rather than a guess), and for anyone with nothing to pull in, just clear
 * the flag — an explicit "I looked, this is fine as-is" rather than leaving
 * it in the queue for lack of a suggestion to accept.
 */
export async function bulkCompletion(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  const mode = String(formData.get('mode') ?? '')
  if (ids.length === 0) return { message: 'Nothing selected.' }

  if (mode === 'delete') {
    const rows = await prisma.crmPerson.findMany({
      where: { id: { in: ids } },
      select: { id: true, coachId: true, recruiterId: true, candidateId: true },
    })
    const safe = rows.filter((r) => !r.coachId && !r.recruiterId && !r.candidateId).map((r) => r.id)
    // Soft delete, matching deletePerson/bulkDeletePeople — a hard delete here
    // would be the one "Remove" that actually meant permanent, while every
    // other "Remove" in the CRM is reversible from a backup.
    if (safe.length > 0) await prisma.crmPerson.updateMany({ where: { id: { in: safe } }, data: { deletedAt: new Date() } })
    captureServerEvent(admin.email ?? 'admin', 'crm_completion_bulk', { mode, count: safe.length })
    revalidatePath(`${CRM}/needs-completion`)
    return {
      message: rows.length - safe.length > 0
        ? `Removed ${safe.length}. Kept ${rows.length - safe.length} already converted to a coach, recruiter or candidate.`
        : `Removed ${safe.length}.`,
    }
  }

  // Apply the export suggestion where one exists; approve as-is otherwise.
  const people = await prisma.crmPerson.findMany({
    where: { id: { in: ids } },
    select: { id: true, linkedinSlug: true, roles: true, needsCompletion: true, affiliations: { select: { id: true } } },
  })
  const slugs = people.map((p) => p.linkedinSlug).filter((s): s is string => Boolean(s))
  const suggestions = await prisma.crmLinkedInConnection.findMany({ where: { slug: { in: slugs } } })
  const bySlug = new Map(suggestions.map((s) => [s.slug, s]))

  let applied = 0
  let approvedAsIs = 0
  for (const p of people) {
    const sug = p.linkedinSlug ? bySlug.get(p.linkedinSlug) : undefined
    let saved = false
    let addJobSeeker = false
    if (sug) {
      const resolved = await resolveSuggestionOrg(sug.company)
      const existing = p.affiliations[0]
      if (resolved.orgId) {
        if (existing) await prisma.crmAffiliation.update({ where: { id: existing.id }, data: { orgId: resolved.orgId, title: sug.position ?? '' } })
        else await prisma.crmAffiliation.create({ data: { personId: p.id, orgId: resolved.orgId, title: sug.position ?? '' } })
        saved = true
      } else if (existing && sug.position) {
        await prisma.crmAffiliation.update({ where: { id: existing.id }, data: { title: sug.position } })
        saved = true
      }
      addJobSeeker = saved && resolved.placeholderKind === 'unemployed' && !p.roles.includes('JOB_SEEKER')
    }
    await prisma.crmPerson.update({
      where: { id: p.id },
      data: {
        ...completionUpdate(true, p.needsCompletion),
        ...(addJobSeeker ? { roles: [...p.roles, 'JOB_SEEKER' as const] } : {}),
      },
    })
    if (saved) applied++
    else approvedAsIs++
  }

  captureServerEvent(admin.email ?? 'admin', 'crm_completion_bulk', { mode: 'approve', applied, approvedAsIs })
  revalidatePath(`${CRM}/needs-completion`)
  return {
    message: applied > 0
      ? `Applied ${applied} suggestion${applied === 1 ? '' : 's'}. Approved ${approvedAsIs} as-is.`
      : `Approved ${approvedAsIs}.`,
  }
}

/** Soft-deletes a single person — same product-account guard as the bulk action. */
export async function deletePerson(personId: string): Promise<{ deleted: boolean; message: string }> {
  const admin = await requireAdmin()
  const p = await prisma.crmPerson.findUnique({
    where: { id: personId },
    select: { fullName: true, coachId: true, recruiterId: true, candidateId: true },
  })
  if (!p) return { deleted: false, message: 'Already gone.' }
  if (p.coachId || p.recruiterId || p.candidateId) {
    const kind = p.candidateId ? 'candidate' : p.coachId ? 'coach' : 'recruiter'
    return { deleted: false, message: `${p.fullName} is a current ${kind} — can’t be removed from the CRM here.` }
  }
  await prisma.crmPerson.update({ where: { id: personId }, data: { deletedAt: new Date() } })
  captureServerEvent(admin.email ?? 'admin', 'crm_person_deleted', { personId })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/needs-completion`)
  // Soft-delete never touches CandidateProfile/Coach/Recruiter — those are
  // separate tables CrmPerson only points at, never the other way around —
  // so removing a CRM row can never block someone from being (or becoming)
  // a candidate, coach, or recruiter later.
  return { deleted: true, message: `Removed ${p.fullName}.` }
}

export interface CrmPersonSearchResult {
  id: string
  fullName: string
  org: string | null
  title: string | null
}

/** Name/email search for the merge-target picker — up to 8 candidates, self excluded. */
export async function searchCrmPeopleByName(query: string, excludeId: string): Promise<CrmPersonSearchResult[]> {
  await requireAdmin()
  const q = query.trim()
  if (q.length < 2) return []
  const rows = await prisma.crmPerson.findMany({
    where: {
      id: { not: excludeId },
      deletedAt: null,
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 8,
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, affiliations: { take: 1, select: { title: true, org: { select: { name: true } } } } },
  })
  return rows.map((r) => ({ id: r.id, fullName: r.fullName, org: r.affiliations[0]?.org.name ?? null, title: r.affiliations[0]?.title ?? null }))
}

/**
 * Merges one person record into another and soft-deletes the source.
 *
 * Several relations carry a unique constraint that includes personId
 * (affiliation × org × title, research authorship × item, segment and
 * broadcast membership) — repointing the source's rows straight at the
 * target would violate those wherever the target already has a matching
 * row, so each of those tables drops the source's duplicate first. Everything
 * else reassigns directly since no personId-scoped uniqueness applies to it.
 */
export async function mergePersonIntoPerson(sourceId: string, targetId: string): Promise<{ message: string }> {
  const admin = await requireAdmin()
  if (sourceId === targetId) return { message: 'Nothing to merge — same record.' }

  const [source, target] = await Promise.all([
    prisma.crmPerson.findUniqueOrThrow({ where: { id: sourceId } }),
    prisma.crmPerson.findUniqueOrThrow({ where: { id: targetId } }),
  ])

  await prisma.$transaction(async (tx) => {
    const targetAffiliations = await tx.crmAffiliation.findMany({ where: { personId: targetId }, select: { orgId: true, title: true } })
    for (const a of targetAffiliations) {
      await tx.crmAffiliation.deleteMany({ where: { personId: sourceId, orgId: a.orgId, title: a.title } })
    }
    await tx.crmAffiliation.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    await tx.crmActivity.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })
    await tx.crmTask.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })
    await tx.crmSourceRecord.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })
    await tx.crmResearchItem.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })
    await tx.productFeedback.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    const targetAuthorItems = await tx.crmResearchAuthor.findMany({ where: { personId: targetId }, select: { itemId: true } })
    for (const r of targetAuthorItems) {
      await tx.crmResearchAuthor.deleteMany({ where: { personId: sourceId, itemId: r.itemId } })
    }
    await tx.crmResearchAuthor.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    const targetSegments = await tx.crmSegmentMember.findMany({ where: { personId: targetId }, select: { segmentId: true } })
    for (const s of targetSegments) {
      await tx.crmSegmentMember.deleteMany({ where: { personId: sourceId, segmentId: s.segmentId } })
    }
    await tx.crmSegmentMember.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    const targetBroadcasts = await tx.crmBroadcastRecipient.findMany({ where: { personId: targetId }, select: { broadcastId: true } })
    for (const b of targetBroadcasts) {
      await tx.crmBroadcastRecipient.deleteMany({ where: { personId: sourceId, broadcastId: b.broadcastId } })
    }
    await tx.crmBroadcastRecipient.updateMany({ where: { personId: sourceId }, data: { personId: targetId } })

    // A suggestion that was previously promoted into the source should point
    // at the surviving record, or accepting it again would recreate the
    // person this merge just folded away.
    await tx.crmSuggestedContact.updateMany({ where: { createdPersonId: sourceId }, data: { createdPersonId: targetId } })

    // Clear the source's slug (and soft-delete it) BEFORE the target claims
    // it — @unique on linkedinSlug means both rows briefly holding the same
    // value, even for one statement, throws P2002. This order must not
    // change without re-checking that.
    await tx.crmPerson.update({ where: { id: sourceId }, data: { deletedAt: new Date(), linkedinSlug: null, mergedIntoId: targetId } })

    // Fill only what the target is missing — an explicit merge target's own
    // data always wins over the record being absorbed into it.
    await tx.crmPerson.update({
      where: { id: targetId },
      data: {
        email: target.email ?? source.email,
        emails: Array.from(new Set([...target.emails, ...source.emails])),
        phone: target.phone ?? source.phone,
        linkedinSlug: target.linkedinSlug ?? source.linkedinSlug,
        linkedinUrl: target.linkedinUrl ?? source.linkedinUrl,
        notes: target.notes ?? source.notes,
        connectedAt: target.connectedAt ?? source.connectedAt,
      },
    })
  })

  await refreshTouchFields([targetId])
  captureServerEvent(admin.email ?? 'admin', 'crm_person_merged', { sourceId, targetId })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/needs-completion`)
  return { message: `Merged ${source.fullName} into ${target.fullName}.` }
}

export interface DuplicateMergeReport {
  groups: number
  merged: number
}

/**
 * Merges exact-duplicate people with no per-pair confirmation.
 *
 * Two signals count as "exact" here, both already the same bar this app uses
 * elsewhere: a shared normalized email, or a shared normalizedKey (name +
 * primary org, computed once at creation — see nameKeyOf above and
 * resolveInput's own ambiguity check, which treats this identical
 * combination as "probably the same person"). Requiring a click per pair for
 * a decision the app already makes once at creation time is just busywork,
 * so this runs the whole batch behind one confirmation instead of many —
 * still explicit, per design-principles.md, just not per-row.
 *
 * Runs email-based groups first, then re-reads before the name+org pass, so
 * a person duplicated under both signals is never merged into two different
 * "winners" in the same run.
 */
export async function autoMergeExactDuplicates(): Promise<DuplicateMergeReport> {
  const admin = await requireAdmin()
  let groups = 0
  let merged = 0

  for (const keyOf of [
    (p: { email: string | null }) => (p.email ? `email:${p.email.toLowerCase()}` : null),
    (p: { normalizedKey: string | null }) => (p.normalizedKey ? `name:${p.normalizedKey}` : null),
  ]) {
    const people = await prisma.crmPerson.findMany({
      where: { deletedAt: null },
      select: {
        id: true, email: true, normalizedKey: true, createdAt: true,
        _count: { select: { activities: true, affiliations: true } },
      },
    })
    const byKey = new Map<string, typeof people>()
    for (const p of people) {
      const key = keyOf(p)
      if (!key) continue
      const arr = byKey.get(key) ?? []
      arr.push(p)
      byKey.set(key, arr)
    }

    for (const cluster of byKey.values()) {
      if (cluster.length < 2) continue
      groups++
      // Richest record wins: most recorded activity, then oldest (the
      // longest-standing record is more likely to be the one other things
      // already point at).
      const [target, ...rest] = [...cluster].sort((a, b) => {
        const scoreA = a._count.activities + a._count.affiliations
        const scoreB = b._count.activities + b._count.affiliations
        if (scoreA !== scoreB) return scoreB - scoreA
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
      for (const loser of rest) {
        await mergePersonIntoPerson(loser.id, target.id)
        merged++
      }
    }
  }

  captureServerEvent(admin.email ?? 'admin', 'crm_auto_merge_duplicates', { groups, merged })
  revalidatePath(CRM)
  return { groups, merged }
}

/**
 * Composes and sends a tracked outreach email through the connected Gmail
 * account, and logs it as a real CrmActivity immediately — unlike the
 * passive sweep, this is a real send the admin explicitly triggered, so
 * there's no ambiguity about whether it happened.
 *
 * Order matters: the tracking row and its links must exist in the database
 * BEFORE the HTML is built, since the click/open URLs embedded in the sent
 * message have to resolve to real rows the moment the recipient opens it.
 * If the actual Gmail send then fails, the just-created activity (and its
 * tracking/links, via cascade) are deleted — a failed send must not leave
 * behind an activity record implying it went out.
 */
export async function sendOutreachEmail(personId: string, subject: string, body: string): Promise<{ sent: boolean; message: string }> {
  const admin = await requireAdmin()
  const subjectTrimmed = subject.trim()
  const bodyTrimmed = body.trim()
  if (!subjectTrimmed || !bodyTrimmed) return { sent: false, message: 'Subject and message are both required.' }

  const person = await prisma.crmPerson.findUniqueOrThrow({ where: { id: personId }, select: { email: true, fullName: true } })
  if (!person.email) return { sent: false, message: `${person.fullName} has no email on file.` }

  const token = await getValidAccessToken()
  if (!token) return { sent: false, message: 'Google isn’t connected — connect it from Activity sync first.' }

  const activity = await prisma.crmActivity.create({
    data: {
      type: 'EMAIL', direction: 'OUTBOUND', personId, subject: subjectTrimmed, body: bodyTrimmed,
      isAutoLogged: false, loggedByEmail: admin.email ?? null,
    },
  })
  const tracking = await prisma.crmOutreachTracking.create({ data: { activityId: activity.id } })

  const urls = extractUrls(bodyTrimmed)
  const urlToLinkId = new Map<string, string>()
  for (const url of urls) {
    const link = await prisma.crmOutreachLink.create({ data: { trackingId: tracking.id, originalUrl: url } })
    urlToLinkId.set(url, link.id)
  }

  try {
    const html = buildTrackedHtml(bodyTrimmed, urlToLinkId, tracking.id)
    const sent = await sendGmailMessage(token, { to: person.email, subject: subjectTrimmed, html })
    await prisma.crmActivity.update({ where: { id: activity.id }, data: { sourceRef: sent.id } })
  } catch (e) {
    await prisma.crmActivity.delete({ where: { id: activity.id } })
    const detail = e instanceof Error ? e.message : String(e)
    const needsReconnect = detail.includes('403') || detail.toLowerCase().includes('insufficient')
    return {
      sent: false,
      message: needsReconnect
        ? 'Gmail rejected the send — reconnect Google from Activity sync to grant send permission (this is a new scope, existing connections need to re-consent).'
        : `Send failed: ${detail}`,
    }
  }

  await refreshTouchFields([personId])
  captureServerEvent(admin.email ?? 'admin', 'crm_outreach_sent', { personId, activityId: activity.id, linkCount: urls.length })
  revalidatePath(CRM)
  revalidatePath(`${CRM}/people/${personId}`)
  return { sent: true, message: `Sent to ${person.fullName}.` }
}
