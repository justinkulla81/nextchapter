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
import { inviteInstitutionUser } from '@/lib/institution/invite'
import { updateInstitutionBranding, uploadInstitutionImage } from '@/lib/institution/admin'
import { importGifts, importRoster } from '@/lib/higher-ed/crm-import'
import { sendJoinInvites } from '@/lib/higher-ed/invites'
import { canAny, type InstitutionCapability } from '@/lib/institution/permissions'
import { requireWorkspace, type WorkspaceContext } from '@/lib/higher-ed/access'
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

const INVITABLE: InstitutionUserRole[] = [
  'INSTITUTION_ADMIN',
  'ALUMNI_RELATIONS',
  'DEVELOPMENT',
  'CAREER_SERVICES',
  'EMPLOYER_RELATIONS',
  'COACH',
  'FACULTY',
  'EXEC_ED',
  'VIEWER',
]

// Admin › Staff. Sends a real email and creates a real login, so it is off on
// demo tenants (whose staff are fictional).
export async function inviteStaff(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  if (ctx.institution.isDemo) return { error: 'Invites are off on demo colleges: their staff are fictional.' }
  const role = String(formData.get('role') ?? '') as InstitutionUserRole
  if (!INVITABLE.includes(role)) return { error: 'Pick a role.' }
  const result = await inviteInstitutionUser({
    institutionSlug: slug,
    email: String(formData.get('email') ?? ''),
    role,
    fullName: (formData.get('fullName') as string | null)?.trim() || null,
  })
  if (result.error) return { error: result.error }
  captureServerEvent(ctx.userId, 'institution_staff_invited', { institutionId: ctx.institution.id, role })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Invite sent.' }
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
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved. Everyone sees the new look on their next page load.' }
}

// ── Admin › Roster (HE-05) ──────────────────────────────────────────────────

export type ImportState =
  | { error?: string; ok?: boolean; summary?: string; errors?: { row: number; column?: string; message: string }[] }
  | undefined

const MAX_CSV_BYTES = 10 * 1024 * 1024

export async function uploadCrmFile(slug: string, kind: 'roster' | 'gifts', _prev: ImportState, formData: FormData): Promise<ImportState> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose a CSV file.' }
  if (file.size > MAX_CSV_BYTES) return { error: 'That file is over 10MB. Split it and upload the parts.' }
  const args = { institutionId: ctx.institution.id, csv: await file.text(), fileName: file.name, createdBy: ctx.email ?? ctx.userId }
  const r = kind === 'roster' ? await importRoster(args) : await importGifts(args)
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
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  await prisma.institution.update({
    where: { id: ctx.institution.id },
    data: {
      givingUrl,
      enabledFeatures: { ...((row.enabledFeatures ?? {}) as Record<string, unknown>), graceDays, fiscalYearStartMonth },
    },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'he_college_settings_saved', { institutionId: ctx.institution.id, graceDays, fiscalYearStartMonth })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved.' }
}
