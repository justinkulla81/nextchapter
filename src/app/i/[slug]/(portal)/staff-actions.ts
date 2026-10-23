'use server'

// Alumni jobs, target companies and staff invites inside /i/[slug]. These
// started as the standalone /institution portal (commit 2f6bda08); the logic
// and the capability map (src/lib/institution/permissions.ts) are theirs, the
// gate is requireWorkspace(): the institution comes from the person's own
// staff rows for this slug, so one college's staff can't act on another's.

import { revalidatePath } from 'next/cache'
import type { InstitutionUserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { fixAllCapsCompanyName } from '@/lib/text/org-name-match'
import { linkPostingToCompany } from '@/lib/companies/posting-company'
import { flagTargetCompany, unflagTargetCompany } from '@/lib/companies/institution-targets'
import { setCoreRecruiter, addRecruitingDate, removeRecruitingDate, addEarlyCareerRole, archiveEarlyCareerRole } from '@/lib/higher-ed/recruiting'
import { inviteInstitutionUser } from '@/lib/institution/invite'
import { updateInstitutionBranding, uploadInstitutionImage } from '@/lib/institution/admin'
import { importGifts, importRoster } from '@/lib/higher-ed/crm-import'
import { sendJoinInvites } from '@/lib/higher-ed/invites'
import { institutionEntitlements, lockedReason } from '@/lib/plans/entitlements'
import { canAny, type InstitutionCapability } from '@/lib/institution/permissions'
import { requireWorkspace, type WorkspaceContext } from '@/lib/higher-ed/access'
import { recordInstitutionAudit } from '@/lib/higher-ed/partner-audit'
import { US_TIME_ZONES } from '@/lib/higher-ed/time-zone'
import type { WorkspaceKey } from '@/lib/higher-ed/workspaces'

export type FormState = { error?: string; ok?: boolean; message?: string } | undefined

async function gate(slug: string, workspace: WorkspaceKey, capability: InstitutionCapability): Promise<WorkspaceContext | null> {
  const ctx = await requireWorkspace(slug, workspace, { write: true })
  return canAny(ctx.tokens, capability) ? ctx : null
}

// A role only this college's alumni see. Created PENDING: a NextChapter admin
// approves it from the usual queue, like every employer-submitted posting.
export async function postAlumniJob(slug: string, workspace: WorkspaceKey, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await gate(slug, workspace, 'post_jobs')
  if (!ctx) return { error: 'You do not have access to post jobs.' }

  const get = (k: string) => (formData.get(k) as string | null)?.trim() || ''
  const title = get('title')
  const companyName = fixAllCapsCompanyName(get('companyName'))
  const url = get('url')
  if (!title) return { error: 'Job title is required.' }
  if (!companyName) return { error: 'Company name is required.' }
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol')
  } catch {
    return { error: 'A real link to the posting is required.' }
  }
  const salaryMin = get('salaryMin') ? Number(get('salaryMin')) : null
  const salaryMax = get('salaryMax') ? Number(get('salaryMax')) : null
  if ((salaryMin !== null && !Number.isFinite(salaryMin)) || (salaryMax !== null && !Number.isFinite(salaryMax))) {
    return { error: 'Salary must be a number.' }
  }
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    return { error: 'Salary minimum cannot be higher than the maximum.' }
  }
  if (await prisma.exclusiveJobPosting.findFirst({ where: { url }, select: { id: true } })) {
    return { error: 'This posting is already on NextChapter.' }
  }

  const posting = await prisma.exclusiveJobPosting.create({
    data: {
      title,
      companyName,
      companyId: await linkPostingToCompany(companyName),
      location: get('location') || null,
      url,
      description: get('description') || null,
      postingType: 'direct',
      salaryMin,
      salaryMax,
      salaryCurrency: 'USD',
      audienceTier: 'ALL_CANDIDATES',
      distribution: 'OPEN',
      disclosure: 'OPEN',
      status: 'pending',
      source: 'institution',
      addedBy: ctx.email ?? 'institution',
      institutionScopeId: ctx.institution.id,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  })
  captureServerEvent(ctx.userId, 'institution_alumni_job_posted', { institutionId: ctx.institution.id, postingId: posting.id, workspace })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Posted. A NextChapter admin reviews it before alumni see it.' }
}

export async function archiveAlumniJob(slug: string, workspace: WorkspaceKey, postingId: string): Promise<void> {
  const ctx = await gate(slug, workspace, 'post_jobs')
  if (!ctx) return
  // Scoped to this college: another college's posting id changes nothing.
  await prisma.exclusiveJobPosting.updateMany({
    where: { id: postingId, institutionScopeId: ctx.institution.id },
    data: { archivedAt: new Date() },
  })
  captureServerEvent(ctx.userId, 'institution_alumni_job_archived', { institutionId: ctx.institution.id })
  revalidatePath(`/i/${slug}`, 'layout')
}

export async function addTargetCompany(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await gate(slug, 'career', 'manage_target_companies')
  if (!ctx) return { error: 'You do not have access to change target companies.' }
  const result = await flagTargetCompany({
    institutionId: ctx.institution.id,
    companyName: (formData.get('companyName') as string | null)?.trim() ?? '',
    note: (formData.get('note') as string | null)?.trim() || null,
    createdBy: ctx.email,
  })
  if ('error' in result) return { error: result.error }
  captureServerEvent(ctx.userId, 'institution_target_company_added', { institutionId: ctx.institution.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

export async function removeTargetCompany(slug: string, companyId: string): Promise<void> {
  const ctx = await gate(slug, 'career', 'manage_target_companies')
  if (!ctx) return
  await unflagTargetCompany(ctx.institution.id, companyId)
  captureServerEvent(ctx.userId, 'institution_target_company_removed', { institutionId: ctx.institution.id })
  revalidatePath(`/i/${slug}`, 'layout')
}

const field = (formData: FormData, k: string) => (formData.get(k) as string | null)?.trim() || ''

/** Flag a target company as a core recruiter (or clear the flag), with its recruiter contact. */
export async function saveCoreRecruiter(slug: string, companyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await gate(slug, 'career', 'manage_target_companies')
  if (!ctx) return { error: 'You do not have access to change target companies.' }
  const core = field(formData, 'core') === 'yes'
  const result = await setCoreRecruiter({
    institutionId: ctx.institution.id, companyId, core,
    contactName: field(formData, 'contactName'), contactEmail: field(formData, 'contactEmail'),
  })
  if ('error' in result) return { error: result.error }
  captureServerEvent(ctx.userId, core ? 'institution_core_recruiter_flagged' : 'institution_core_recruiter_cleared', { institutionId: ctx.institution.id, companyId })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

export async function addRecruitingDateAction(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await gate(slug, 'career', 'manage_target_companies')
  if (!ctx) return { error: 'You do not have access to change the recruiting calendar.' }
  const result = await addRecruitingDate({
    institutionId: ctx.institution.id, companyName: fixAllCapsCompanyName(field(formData, 'companyName')),
    kind: field(formData, 'kind'), title: field(formData, 'title'), startsAt: field(formData, 'startsAt'),
    location: field(formData, 'location'), url: field(formData, 'url'), note: field(formData, 'note'), createdBy: ctx.email,
  })
  if ('error' in result) return { error: result.error }
  captureServerEvent(ctx.userId, 'institution_recruiting_date_added', { institutionId: ctx.institution.id, companyId: result.companyId, kind: field(formData, 'kind') })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

export async function removeRecruitingDateAction(slug: string, id: string): Promise<void> {
  const ctx = await gate(slug, 'career', 'manage_target_companies')
  if (!ctx) return
  await removeRecruitingDate(ctx.institution.id, id)
  captureServerEvent(ctx.userId, 'institution_recruiting_date_removed', { institutionId: ctx.institution.id, dateId: id })
  revalidatePath(`/i/${slug}`, 'layout')
}

export async function addEarlyCareerRoleAction(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await gate(slug, 'career', 'manage_target_companies')
  if (!ctx) return { error: 'You do not have access to change early-career roles.' }
  const result = await addEarlyCareerRole({
    institutionId: ctx.institution.id, companyName: fixAllCapsCompanyName(field(formData, 'companyName')),
    kind: field(formData, 'kind'), title: field(formData, 'title'), location: field(formData, 'location'),
    applyUrl: field(formData, 'applyUrl'), deadline: field(formData, 'deadline'), classYears: field(formData, 'classYears'),
    note: field(formData, 'note'), createdBy: ctx.email,
  })
  if ('error' in result) return { error: result.error }
  captureServerEvent(ctx.userId, 'institution_early_career_role_added', { institutionId: ctx.institution.id, companyId: result.companyId, kind: field(formData, 'kind') })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

export async function archiveEarlyCareerRoleAction(slug: string, id: string): Promise<void> {
  const ctx = await gate(slug, 'career', 'manage_target_companies')
  if (!ctx) return
  await archiveEarlyCareerRole(ctx.institution.id, id)
  captureServerEvent(ctx.userId, 'institution_early_career_role_archived', { institutionId: ctx.institution.id, roleId: id })
  revalidatePath(`/i/${slug}`, 'layout')
}

const INVITABLE: InstitutionUserRole[] = [
  'INSTITUTION_ADMIN',
  'ALUMNI_RELATIONS',
  'DEVELOPMENT',
  'CAREER_SERVICES',
  'EMPLOYER_RELATIONS',
  'COACH',
  'FACULTY',
  'EXEC_ED',
  'WORKFORCE_PARTNER',
  'VIEWER',
]

// Admin › Staff. Sends a real email and creates a real login, so it is off on
// demo tenants (whose staff are fictional).
export async function inviteStaff(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  if (ctx.institution.isDemo) return { error: 'Invites are off on demo colleges: their staff are fictional.' }
  const role = String(formData.get('role') ?? '') as InstitutionUserRole
  if (!INVITABLE.includes(role)) return { error: 'Pick a role.' }
  // The free plan has the administrator only; other staff roles are part of the paid plan.
  if (role !== 'INSTITUTION_ADMIN' && !institutionEntitlements({ plan: ctx.institution.plan }).staffRoles) {
    captureServerEvent(ctx.userId, 'entitlement_locked_attempted', { feature: 'staffRoles', plan: ctx.institution.plan, slug, role })
    return { error: lockedReason('staffRoles') }
  }
  const workspace = role === 'VIEWER' ? String(formData.get('workspace') ?? '') : null
  if (role === 'VIEWER' && !VIEWER_WORKSPACES.includes(workspace as WorkspaceKey)) return { error: 'Pick which workspace this viewer can see.' }
  const result = await inviteInstitutionUser({
    institutionSlug: slug,
    email: String(formData.get('email') ?? ''),
    role,
    fullName: (formData.get('fullName') as string | null)?.trim() || null,
    workspace,
  })
  if (result.error) return { error: result.error }
  captureServerEvent(ctx.userId, 'institution_staff_invited', { institutionId: ctx.institution.id, role, workspace })
  await recordInstitutionAudit(ctx, 'team.invited', { type: 'staff', detail: { role } })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Invite sent.' }
}

const VIEWER_WORKSPACES: WorkspaceKey[] = ['alumni', 'development', 'career', 'teaching', 'execed', 'workforce']

// Admin › Staff: remove someone's seat (they lose this role at once), or
// resend an invite nobody has accepted yet.
export async function removeStaff(slug: string, staffId: string): Promise<{ error?: string; message?: string }> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  if (ctx.institution.isDemo) return { error: 'Staff changes are off on demo colleges.' }
  const row = await prisma.institutionUser.findFirst({ where: { id: staffId, institutionId: ctx.institution.id, revokedAt: null }, select: { role: true, userId: true } })
  if (!row) return { error: 'Already removed.' }
  if (row.userId === ctx.userId && row.role === 'INSTITUTION_ADMIN') return { error: 'You can’t remove your own admin seat. Ask another admin.' }
  if (row.role === 'INSTITUTION_ADMIN' && (await prisma.institutionUser.count({ where: { institutionId: ctx.institution.id, role: 'INSTITUTION_ADMIN', revokedAt: null, acceptedAt: { not: null } } })) <= 1) {
    return { error: 'This is the college’s only active admin. Invite another admin first.' }
  }
  await prisma.institutionUser.update({ where: { id: staffId }, data: { revokedAt: new Date() } })
  captureServerEvent(ctx.userId, 'institution_staff_removed', { institutionId: ctx.institution.id, role: row.role })
  await recordInstitutionAudit(ctx, 'team.removed', { type: 'staff', id: staffId, detail: { role: row.role } })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: 'Removed. They lose this role right away.' }
}

export async function resendStaffInvite(slug: string, staffId: string): Promise<{ error?: string; message?: string }> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  if (ctx.institution.isDemo) return { error: 'Invites are off on demo colleges: their staff are fictional.' }
  const row = await prisma.institutionUser.findFirst({ where: { id: staffId, institutionId: ctx.institution.id }, select: { invitedEmail: true, role: true, workspace: true, acceptedAt: true, revokedAt: true } })
  if (!row) return { error: 'That invite is gone.' }
  if (row.acceptedAt && !row.revokedAt) return { error: 'They’ve already accepted.' }
  const r = await inviteInstitutionUser({ institutionSlug: slug, email: row.invitedEmail, role: row.role, workspace: row.workspace })
  if (r.error) return { error: r.error }
  captureServerEvent(ctx.userId, 'institution_staff_invite_resent', { institutionId: ctx.institution.id, role: row.role })
  await recordInstitutionAudit(ctx, 'team.invite_resent', { type: 'staff', id: staffId, detail: { role: row.role } })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: 'Invite sent again.' }
}

// Admin › Branding: the college's own admins set their look (the same fields
// NextChapter admins set under Admin › Institutions).
export async function saveBranding(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const get = (k: string) => (formData.get(k) as string | null)?.trim() ?? ''
  const accent = get('accentColor')
  if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) return { error: 'Use a six-digit color like #A93439.' }
  const logo = await uploadInstitutionImage(ctx.institution.id, formData.get('logo') as File | null, 'logo')
  const hero = await uploadInstitutionImage(ctx.institution.id, formData.get('hero') as File | null, 'hero')
  if (logo && typeof logo === 'object') return { error: logo.error }
  if (hero && typeof hero === 'object') return { error: hero.error }
  await updateInstitutionBranding(ctx.institution.id, {
    programBrandName: get('programBrandName') || null,
    accentColor: accent || null,
    tagline: get('tagline') || null,
    ...(logo ? { logoUrl: logo } : {}),
    ...(hero ? { heroImageUrl: hero } : {}),
  })
  captureServerEvent(ctx.userId, 'he_branding_saved', { institutionId: ctx.institution.id, logo: !!logo, hero: !!hero })
  await recordInstitutionAudit(ctx, 'brand.updated', { type: 'institution', id: ctx.institution.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved. Everyone sees the new look on their next page load.' }
}

// ── Admin › Roster (HE-05) ──────────────────────────────────────────────────

export type ImportState =
  | { error?: string; ok?: boolean; summary?: string; errors?: { row: number; column?: string; message: string }[] }
  | undefined

const MAX_CSV_BYTES = 10 * 1024 * 1024

export async function uploadCrmFile(slug: string, kind: 'roster' | 'gifts', _prev: ImportState, formData: FormData): Promise<ImportState> {
  return runCrmImport(await requireWorkspace(slug, 'admin', { write: true }), kind, formData)
}

// Development uploads gifts from its own CRM exchange tab.
export async function uploadGiftsFromDevelopment(slug: string, _prev: ImportState, formData: FormData): Promise<ImportState> {
  const ctx = await requireWorkspace(slug, 'development', { write: true })
  if (!ctx.tokens.has('DEVELOPMENT') && !ctx.tokens.has('INSTITUTION_ADMIN')) return { error: 'Only Development or a college admin can upload gifts.' }
  return runCrmImport(ctx, 'gifts', formData)
}

async function runCrmImport(ctx: WorkspaceContext, kind: 'roster' | 'gifts', formData: FormData): Promise<ImportState> {
  const slug = ctx.institution.slug
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose a CSV file.' }
  if (file.size > MAX_CSV_BYTES) return { error: 'That file is over 10MB. Split it and upload the parts.' }
  const args = { institutionId: ctx.institution.id, csv: await file.text(), fileName: file.name, createdBy: ctx.email ?? ctx.userId }
  const r = kind === 'roster' ? await importRoster(args) : await importGifts(args)
  if (r.capReached) return { error: `${r.capReached.message} Nothing was imported.` }
  captureServerEvent(ctx.userId, kind === 'roster' ? 'he_roster_imported' : 'he_gifts_imported', {
    institutionId: ctx.institution.id,
    runId: r.runId,
    imported: r.imported,
    updated: r.updated,
    errors: r.errors.length,
  })
  revalidatePath(`/i/${slug}`, 'layout')
  if (r.fileError) return { error: `${r.fileError}. Nothing was imported.` }
  const summary =
    kind === 'roster'
      ? `${r.imported} added, ${r.updated} updated${r.errors.length ? `, ${r.errors.length} rows skipped` : ''}.`
      : `${r.imported} gifts added${r.skipped ? `, ${r.skipped} skipped (already imported or invalid)` : ''}.`
  return { ok: true, summary, errors: r.errors.slice(0, 50) }
}

export async function sendInvitations(slug: string): Promise<{ error?: string; message?: string }> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const r = await sendJoinInvites({ institutionId: ctx.institution.id, createdBy: ctx.email ?? ctx.userId })
  if (r.capReached) {
    revalidatePath(`/i/${slug}`, 'layout')
    return { error: `${r.sent ? `${r.sent} invitations sent. ` : ''}${r.capReached.message}` }
  }
  captureServerEvent(ctx.userId, 'he_join_invites_sent', { institutionId: ctx.institution.id, sent: r.sent, demo: r.demo })
  revalidatePath(`/i/${slug}`, 'layout')
  const where = r.demo ? 'recorded in the demo outbox (no email sent)' : 'sent'
  return { message: `${r.sent} invitations ${where}.${r.remaining ? ` ${r.remaining} more to go: send again for the next batch.` : ''}` }
}

// ── Admin › Overview settings (HE-04) ───────────────────────────────────────

export async function saveCollegeSettings(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const graceDays = Number(formData.get('graceDays'))
  const fiscalYearStartMonth = Number(formData.get('fiscalYearStartMonth'))
  const givingUrl = String(formData.get('givingUrl') ?? '').trim() || null
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 365) return { error: 'Grace period is 0 to 365 days.' }
  if (!(fiscalYearStartMonth >= 1 && fiscalYearStartMonth <= 12)) return { error: 'Pick the month your fiscal year starts.' }
  if (givingUrl && !/^https:\/\/\S+$/.test(givingUrl)) return { error: 'The giving page must be an https:// link.' }
  const fromName = String(formData.get('fromName') ?? '').trim().replace(/["<>\r\n]/g, '').slice(0, 80)
  const replyTo = String(formData.get('replyTo') ?? '').trim().toLowerCase()
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) return { error: 'Replies go to must be an email address, like alumni@yourcollege.edu.' }
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  await prisma.institution.update({
    where: { id: ctx.institution.id },
    data: {
      givingUrl,
      enabledFeatures: { ...((row.enabledFeatures ?? {}) as Record<string, unknown>), graceDays, fiscalYearStartMonth, wioa: formData.get('wioa') === 'on', ...(US_TIME_ZONES.some((z) => z.key === formData.get('timeZone')) ? { timeZone: String(formData.get('timeZone')) } : {}), email: { fromName: fromName || null, replyTo: replyTo || null } },
    },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'he_college_settings_saved', { institutionId: ctx.institution.id, graceDays, fiscalYearStartMonth, hasFromName: !!fromName, hasReplyTo: !!replyTo, wioa: formData.get('wioa') === 'on' })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved.' }
}
