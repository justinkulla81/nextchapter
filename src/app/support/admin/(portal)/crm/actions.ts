'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isRealOrgName } from '@/lib/crm/normalize'
import { extractDateCandidates, htmlToText } from '@/lib/crm/date-check'
import type {
  CrmPersonRole, CrmLeadQuality, CrmWarmth,
  CrmIntroPathStrength, CrmIntroPathStatus, CrmResearchStance,
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

// ── Pipelines (Phase 4) ──────────────────────────────────────────────────────

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
      return { ok: false, message: `That page returned ${res.status}. The programme may have moved or been taken down.` }
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
 * A connector is either a real person in the CRM (searchable across all 3,688)
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

// ── Sync review (Phase 7) ────────────────────────────────────────────────────

/** Turns a frequent correspondent into a real CRM person. */
export async function acceptSuggestedContact(suggestionId: string) {
  const admin = await requireAdmin()
  const s = await prisma.crmSuggestedContact.findUniqueOrThrow({ where: { id: suggestionId } })
  if (s.status !== 'PENDING') return

  const existing = await prisma.crmPerson.findFirst({ where: { email: s.email } })
  const person = existing ?? await prisma.crmPerson.create({
    data: {
      fullName: s.displayName ?? s.email.split('@')[0],
      firstName: s.displayName?.split(' ')[0] ?? null,
      lastName: s.displayName?.split(' ').slice(1).join(' ') || null,
      email: s.email,
      emails: [s.email],
      needsCompletion: true,
      roles: [],
    },
  })

  await prisma.crmSuggestedContact.update({
    where: { id: suggestionId },
    data: { status: 'ADDED', createdPersonId: person.id, resolvedAt: new Date(), resolvedByEmail: admin.email ?? null },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_suggested_contact_accepted', {
    suggestionId, personId: person.id, messageCount: s.messageCount,
  })
  revalidatePath(`${CRM}/sync`)
}

/** Dismisses a correspondent — they stay dismissed on later sweeps. */
export async function ignoreSuggestedContact(suggestionId: string) {
  const admin = await requireAdmin()
  await prisma.crmSuggestedContact.update({
    where: { id: suggestionId },
    data: { status: 'IGNORED', resolvedAt: new Date(), resolvedByEmail: admin.email ?? null },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_suggested_contact_ignored', { suggestionId })
  revalidatePath(`${CRM}/sync`)
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
