'use server'

// V2 programs: Exec Ed (programs, cohorts, enrollment, corporate clients),
// Teaching (capstones), Employer (propose a capstone), Candidate (apply).

import { revalidatePath } from 'next/cache'
import type { CapstoneStatus, EnrollmentStatus, ProgramPayer } from '@prisma/client'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace, type WorkspaceContext } from '@/lib/higher-ed/access'
import type { AccessToken, WorkspaceKey } from '@/lib/higher-ed/workspaces'
import { employerProfileFor } from '@/lib/higher-ed/employers'
import { prisma } from '@/lib/prisma'
import { addCohort, APPLY_PAYERS, applyToCohort, proposeCapstone, saveClient, saveProgram, updateCapstone, updateEnrollment } from '@/lib/higher-ed/programs'

export type FormResult = { error?: string; ok?: boolean; message?: string } | undefined

async function staff(slug: string, ws: WorkspaceKey, roles: AccessToken[]): Promise<WorkspaceContext | null> {
  const ctx = await requireWorkspace(slug, ws, { write: true })
  return roles.some((r) => ctx.tokens.has(r)) ? ctx : null
}
const EXEC: AccessToken[] = ['EXEC_ED', 'INSTITUTION_ADMIN']
const TEACH: AccessToken[] = ['FACULTY', 'EXEC_ED', 'INSTITUTION_ADMIN']
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const dollars = (v: string) => {
  const n = Number(v.replace(/[$,\s]/g, '') || '0')
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}
const PAYERS: ProgramPayer[] = ['SELF_PAY', 'EMPLOYER', 'RESILIENCE_FUND', 'WIOA_VOUCHER', 'BOARD_CONTRACT', 'PELL']
const STATUSES: EnrollmentStatus[] = ['APPLIED', 'ENROLLED', 'COMPLETED', 'WITHDREW']
const CAPSTONE: CapstoneStatus[] = ['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED']

export async function saveProgramForm(slug: string, id: string | null, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'execed', EXEC)
  if (!ctx) return { error: 'Only Exec Ed staff or a college admin can edit programs.' }
  const name = str(f, 'name')
  const priceCents = dollars(str(f, 'price'))
  if (!name) return { error: 'Give the program a name.' }
  if (priceCents === null) return { error: 'Price is a dollar amount, like 1500 (0 for free).' }
  const r = await saveProgram({
    institutionId: ctx.institution.id,
    id,
    name,
    summary: str(f, 'summary') || null,
    audience: str(f, 'audience') || null,
    credential: str(f, 'credential') || null,
    priceCents,
    wioaEligible: f.get('wioaEligible') === 'on',
    isActive: f.get('isActive') !== 'off',
    createdBy: ctx.email ?? ctx.userId,
  })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_program_saved', { institutionId: ctx.institution.id, programId: r.id, isNew: !id, priceCents, wioaEligible: f.get('wioaEligible') === 'on' })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: id ? 'Saved.' : 'Program added. Add a cohort so alumni can apply.' }
}

export async function addCohortForm(slug: string, programId: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'execed', EXEC)
  if (!ctx) return { error: 'Only Exec Ed staff or a college admin can add cohorts.' }
  const name = str(f, 'name')
  const startsAt = str(f, 'startsAt') ? new Date(`${str(f, 'startsAt')}T12:00:00Z`) : null
  const endsAt = str(f, 'endsAt') ? new Date(`${str(f, 'endsAt')}T12:00:00Z`) : null
  const seats = str(f, 'seats') ? Number(str(f, 'seats')) : null
  if (!name) return { error: 'Name the cohort, like “Spring 2027, online”.' }
  if (!startsAt || Number.isNaN(startsAt.getTime())) return { error: 'Pick a start date.' }
  if (endsAt && endsAt < startsAt) return { error: 'The end date is before the start date.' }
  if (seats !== null && (!Number.isInteger(seats) || seats < 1)) return { error: 'Seats is a whole number, or leave it blank for no limit.' }
  const modality = ['online', 'in_person', 'hybrid'].includes(str(f, 'modality')) ? str(f, 'modality') : null
  const r = await addCohort({ institutionId: ctx.institution.id, programId, name, startsAt, endsAt, seats, modality, facultyUserId: str(f, 'facultyUserId') || null })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_cohort_added', { institutionId: ctx.institution.id, programId, cohortId: r.id, seats, modality })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Cohort added. Alumni can apply from their Programs tab.' }
}

export async function setEnrollment(slug: string, enrollmentId: string, change: { status?: string; payer?: string; corporateClientId?: string | null }): Promise<{ error?: string; ok?: boolean }> {
  const ctx = await staff(slug, 'execed', EXEC)
  if (!ctx) return { error: 'Only Exec Ed staff or a college admin can change enrollments.' }
  const status = change.status && STATUSES.includes(change.status as EnrollmentStatus) ? (change.status as EnrollmentStatus) : undefined
  const payer = change.payer && PAYERS.includes(change.payer as ProgramPayer) ? (change.payer as ProgramPayer) : undefined
  const r = await updateEnrollment({ institutionId: ctx.institution.id, enrollmentId, status, payer, corporateClientId: change.corporateClientId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_enrollment_updated', { institutionId: ctx.institution.id, enrollmentId, status, payer })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

export async function saveClientForm(slug: string, id: string | null, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'execed', EXEC)
  if (!ctx) return { error: 'Only Exec Ed staff or a college admin can edit clients.' }
  const name = str(f, 'name')
  const seats = Number(str(f, 'seatsPurchased') || '0')
  const email = str(f, 'contactEmail').toLowerCase()
  if (!name) return { error: 'Add the company name.' }
  if (!Number.isInteger(seats) || seats < 0) return { error: 'Seats purchased is a whole number.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That contact email doesn’t look right.' }
  const r = await saveClient({ institutionId: ctx.institution.id, id, name, contactName: str(f, 'contactName') || null, contactEmail: email || null, seatsPurchased: seats, notes: str(f, 'notes') || null })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_corporate_client_saved', { institutionId: ctx.institution.id, clientId: r.id, isNew: !id, seats })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved.' }
}

export async function setCapstone(slug: string, id: string, status: string, facultyUserId?: string | null): Promise<{ error?: string; ok?: boolean }> {
  const ctx = await staff(slug, 'teaching', TEACH)
  if (!ctx) return { error: 'Only faculty, Exec Ed or a college admin can decide capstones.' }
  if (!CAPSTONE.includes(status as CapstoneStatus)) return { error: 'Unknown status.' }
  // Approving with no lead puts the approving faculty member on it.
  const lead = facultyUserId ?? (status === 'APPROVED' ? (ctx.staffUsers.find((s) => s.role === 'FACULTY')?.id ?? undefined) : undefined)
  const r = await updateCapstone({ institutionId: ctx.institution.id, id, status: status as CapstoneStatus, facultyUserId: lead })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_capstone_updated', { institutionId: ctx.institution.id, capstoneId: id, status })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// From the Employer workspace (their own company) or Teaching (any employer).
export async function proposeCapstoneForm(slug: string, from: 'employer' | 'teaching', _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = from === 'employer' ? await requireWorkspace(slug, 'employer', { write: true }) : await staff(slug, 'teaching', TEACH)
  if (!ctx) return { error: 'Only faculty, Exec Ed or a college admin can add capstones here.' }
  const title = str(f, 'title')
  const brief = str(f, 'brief')
  if (!title) return { error: 'Give the project a title.' }
  if (brief.length < 20) return { error: 'Describe the project in a few sentences: the problem, the data, what you’d like delivered.' }
  let employerName = str(f, 'employerName')
  let institutionEmployerId: string | null = null
  if (from === 'employer') {
    const profileId = await employerProfileFor(ctx)
    if (!profileId) return { error: 'Your company isn’t approved at this college.' }
    const link = await prisma.institutionEmployer.findUniqueOrThrow({
      where: { institutionId_employerProfileId: { institutionId: ctx.institution.id, employerProfileId: profileId } },
      select: { id: true, employerProfile: { select: { companyName: true } } },
    })
    institutionEmployerId = link.id
    employerName = link.employerProfile.companyName
  }
  if (!employerName) return { error: 'Which employer is sponsoring it?' }
  const r = await proposeCapstone({
    institutionId: ctx.institution.id,
    institutionEmployerId,
    employerName,
    title,
    brief,
    term: str(f, 'term') || null,
    interviewCommitments: Number(str(f, 'interviewCommitments') || '0'),
    proposedBy: ctx.email ?? ctx.userId,
  })
  captureServerEvent(ctx.userId, 'he_capstone_proposed', { institutionId: ctx.institution.id, capstoneId: r.id, from, interviews: Number(str(f, 'interviewCommitments') || '0') })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: from === 'employer' ? 'Proposed. Faculty will review it and get back to you.' : 'Added.' }
}

export async function applyToProgram(slug: string, cohortId: string, payer: string, note: string): Promise<{ error?: string; ok?: boolean }> {
  const ctx = await requireWorkspace(slug, 'candidate', { write: true })
  if (!ctx.memberId) return { error: 'You’re previewing as an alum; there’s no member record to apply as.' }
  if (!APPLY_PAYERS.some((p) => p.key === payer)) return { error: 'Pick how you’ll pay.' }
  const r = await applyToCohort({ institutionId: ctx.institution.id, memberId: ctx.memberId, cohortId, payer: payer as (typeof APPLY_PAYERS)[number]['key'], note })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_program_applied', { institutionId: ctx.institution.id, cohortId, enrollmentId: r.id, payer })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return { ok: true }
}
