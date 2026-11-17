'use server'

// Program workspace (workforce customers): member companies, layoff seat
// offers, participants and the stay-local region.

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { placeAt } from '@/lib/workforce/local'
import { STATE_NAMES } from '@/lib/workforce/places'
import { mainOrigin } from '@/lib/org-hosts'
import { inviteMemberCompany, syncMemberAccess } from '@/lib/workforce/member-access'
import { answerSeatRequest } from '@/lib/workforce/company-portal'
import { RESPONSE_STEPS } from '@/lib/workforce/program-content'
import { FUNDING_STATUS_KEYS } from '@/lib/workforce/hub-flow'
import { fixAllCapsCompanyName } from '@/lib/text/org-name-match'
import { linkPostingToCompany } from '@/lib/companies/posting-company'
import { parseJobRows } from '@/lib/workforce/group-jobs'
import { PARTNER_KIND_KEYS, normalizeScopes } from '@/lib/workforce/partner-views'
import { randomBytes } from 'crypto'
import { ECO_KIND_KEYS, canDecide, canInvite } from '@/lib/workforce/ecosystem'
import { nearbyColleges } from '@/lib/workforce/colleges-near'

type Result = { error?: string; ok?: boolean; message?: string }
export type HubResult = Result | undefined

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function hub(slug: string) {
  return requireWorkspace(slug, 'hub', { write: true })
}

async function seatsLeft(institutionId: string) {
  const [inst, given] = await Promise.all([
    prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { includedSeats: true } }),
    prisma.rapidResponse.aggregate({ where: { institutionId, isActive: true, memberCompanyId: { not: null } }, _sum: { seats: true } }),
  ])
  return inst.includedSeats - (given._sum.seats ?? 0)
}

export async function addMemberCompany(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const name = str(f, 'name').slice(0, 120)
  if (!name) return { error: 'Add the company’s name.' }
  const email = str(f, 'contactEmail').toLowerCase()
  if (email && !EMAIL.test(email)) return { error: 'That contact email doesn’t look right.' }
  const state = str(f, 'state').toUpperCase()
  if (state && !STATE_NAMES[state]) return { error: 'Use the two-letter state, like KY.' }
  try {
    const c = await prisma.memberCompany.create({
      data: {
        institutionId: ctx.institution.id,
        name,
        industry: str(f, 'industry').slice(0, 80) || null,
        city: str(f, 'city').slice(0, 80) || null,
        state: state || null,
        contactName: str(f, 'contactName').slice(0, 120) || null,
        contactEmail: email || null,
        hiring: f.get('hiring') === 'on',
      },
      select: { id: true },
    })
    captureServerEvent(ctx.userId, 'hub_member_company_added', { institutionId: ctx.institution.id, companyId: c.id })
  } catch {
    return { error: `${name} is already on your list.` }
  }
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `${name} added.` }
}

export async function setCompanyHiring(slug: string, companyId: string, hiring: boolean): Promise<Result> {
  const ctx = await hub(slug)
  const r = await prisma.memberCompany.updateMany({ where: { id: companyId, institutionId: ctx.institution.id }, data: { hiring } })
  if (!r.count) return { error: 'That company is gone. Reload the page.' }
  await syncMemberAccess(ctx.institution.id, companyId)
  captureServerEvent(ctx.userId, 'hub_member_company_hiring_set', { institutionId: ctx.institution.id, companyId, hiring })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// A layoff at a member company: seats from the pool and a public sign-up page.
export async function openLayoffSeats(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const companyId = str(f, 'companyId')
  const seats = Number(str(f, 'seats'))
  const company = await prisma.memberCompany.findFirst({ where: { id: companyId, institutionId: ctx.institution.id }, select: { id: true, name: true } })
  if (!company) return { error: 'Pick the company.' }
  if (!Number.isInteger(seats) || seats < 1 || seats > 5000) return { error: 'Seats must be a whole number from 1 to 5,000.' }
  const left = await seatsLeft(ctx.institution.id)
  if (seats > left) return { error: left > 0 ? `Only ${left.toLocaleString()} seats are left in your pool. Lower the number, or ask NextChapter to add seats.` : 'Your seat pool is used up. Ask NextChapter to add seats.' }
  const warnNoticeId = str(f, 'warnNoticeId') || null
  const brand = ctx.institution.programBrandName ?? ctx.institution.name
  const title = str(f, 'title').slice(0, 140) || `Free career support for ${company.name} employees`
  const message =
    str(f, 'message').slice(0, 2000) ||
    `${brand} is giving people affected by the ${company.name} layoff free access to NextChapter: an honest read on your job market, a plan for each week, coaching, and local employers who are hiring. Sign up below to claim your seat.`
  const r = await prisma.rapidResponse.create({
    data: { institutionId: ctx.institution.id, memberCompanyId: company.id, seats, warnNoticeId, employerName: company.name, title, message, programIds: [], createdBy: ctx.email ?? ctx.userId },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'hub_layoff_seats_opened', { institutionId: ctx.institution.id, companyId: company.id, rapidResponseId: r.id, seats, fromWarn: !!warnNoticeId })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `Seats open. Share the sign-up page: ${mainOrigin()}/i/${slug}/rapid/${r.id}` }
}

export async function setLayoffOpen(slug: string, id: string, isActive: boolean): Promise<Result> {
  const ctx = await hub(slug)
  const r = await prisma.rapidResponse.updateMany({ where: { id, institutionId: ctx.institution.id }, data: { isActive } })
  if (!r.count) return { error: 'That offer is gone. Reload the page.' }
  captureServerEvent(ctx.userId, 'hub_layoff_seats_toggled', { institutionId: ctx.institution.id, rapidResponseId: id, isActive })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

export async function addParticipant(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const email = str(f, 'email').toLowerCase()
  if (!str(f, 'firstName')) return { error: 'Add their first name.' }
  if (!EMAIL.test(email)) return { error: 'Add a valid email.' }
  const companyId = str(f, 'companyId') || null
  if (companyId && !(await prisma.memberCompany.count({ where: { id: companyId, institutionId: ctx.institution.id } }))) return { error: 'That company is gone. Reload the page.' }
  const existing = await prisma.institutionMember.findFirst({ where: { institutionId: ctx.institution.id, email }, select: { id: true } })
  if (existing) return { error: 'That email is already on your roster.' }
  const m = await prisma.institutionMember.create({
    data: { institutionId: ctx.institution.id, email, firstName: str(f, 'firstName').slice(0, 80), lastName: str(f, 'lastName').slice(0, 80) || null, affiliation: 'PARTICIPANT', matchMethod: 'MANUAL', memberCompanyId: companyId, isActiveSeat: true, seatActivatedAt: new Date() },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'hub_participant_added', { institutionId: ctx.institution.id, memberId: m.id, companyId })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Added. Send their invitation from Admin › Roster, or share your sign-up page.' }
}

export async function saveLocalArea(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const anchorCity = str(f, 'anchorCity').slice(0, 80)
  const anchorState = str(f, 'anchorState').toUpperCase()
  const radiusMiles = Number(str(f, 'radiusMiles') || '40')
  if (!anchorCity || !STATE_NAMES[anchorState]) return { error: 'Add the main city and its two-letter state, like Louisville, KY.' }
  if (!Number.isInteger(radiusMiles) || radiusMiles < 5 || radiusMiles > 150) return { error: 'The radius must be 5 to 150 miles.' }
  if (!(await placeAt(anchorCity, anchorState))) return { error: `We can’t find ${anchorCity}, ${anchorState} in the Census place list. Check the spelling, or use the nearest larger city.` }
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const ef = (inst.enabledFeatures ?? {}) as Record<string, unknown>
  const label = str(f, 'label').slice(0, 60) || `the ${anchorCity} area`
  await prisma.institution.update({ where: { id: ctx.institution.id }, data: { enabledFeatures: { ...ef, local: { anchorCity, anchorState, radiusMiles, label } } } })
  captureServerEvent(ctx.userId, 'hub_local_area_saved', { institutionId: ctx.institution.id, anchorState, radiusMiles })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `Saved. Jobs within ${radiusMiles} miles of ${anchorCity} now rank first for your participants.` }
}

// Give a member company a login to its portal (layoff seats, its people, hiring).
export async function inviteMemberContact(slug: string, companyId: string, email: string): Promise<Result & { path?: string; sent?: boolean }> {
  const ctx = await hub(slug)
  const r = await inviteMemberCompany({ institutionId: ctx.institution.id, companyId, email })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'hub_member_company_invited', { institutionId: ctx.institution.id, companyId, emailed: r.sent })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, sent: r.sent, path: r.path, message: r.sent ? `Invite sent to ${email.trim().toLowerCase()}.` : 'Demo: nothing is emailed. Share this link instead.' }
}

// A member company's seat request: approve with the seats given, or decline.
export async function answerSeatRequestAction(slug: string, id: string, approve: boolean, seats?: number): Promise<Result> {
  const ctx = await hub(slug)
  const r = await answerSeatRequest({ institutionId: ctx.institution.id, id, approve, seats, orgBrand: ctx.institution.programBrandName ?? ctx.institution.name })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, approve ? 'hub_seat_request_approved' : 'hub_seat_request_declined', { institutionId: ctx.institution.id, rapidResponseId: id, seats })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// ── Phase 2: layoff response steps and funding applications ─────────────────

const STEP_KEYS: string[] = RESPONSE_STEPS.map((s) => s.key)
const whole = (f: FormData, k: string): number | null | 'bad' => {
  const v = str(f, k).replace(/[$,\s]/g, '')
  if (!v) return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000_000 ? n : 'bad'
}

// Mark one step of a layoff response done, or take it back.
export async function setResponseStep(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const responseId = str(f, 'responseId')
  const key = str(f, 'key')
  const done = str(f, 'done') === '1'
  if (!STEP_KEYS.includes(key)) return { error: 'That step does not exist.' }
  const r = await prisma.rapidResponse.findFirst({ where: { id: responseId, institutionId: ctx.institution.id }, select: { id: true } })
  if (!r) return { error: 'That layoff response was not found.' }
  if (done) {
    await prisma.rapidResponseStep.upsert({ where: { rapidResponseId_key: { rapidResponseId: r.id, key } }, create: { rapidResponseId: r.id, key, doneBy: ctx.userId }, update: {} })
  } else {
    await prisma.rapidResponseStep.deleteMany({ where: { rapidResponseId: r.id, key } })
  }
  captureServerEvent(ctx.userId, done ? 'layoff_response_step_done' : 'layoff_response_step_undone', { institutionId: ctx.institution.id, rapidResponseId: r.id, step: key })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// Create or update a funding application.
export async function saveFundingApplication(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const id = str(f, 'id')
  const name = str(f, 'name').slice(0, 160)
  if (!name) return { error: 'Add the name of the grant or funding.' }
  const status = str(f, 'status') || 'CONSIDERING'
  if (!FUNDING_STATUS_KEYS.includes(status)) return { error: 'Pick a status from the list.' }
  const nums = { amountRequested: whole(f, 'amountRequested'), amountAwarded: whole(f, 'amountAwarded'), matchRequired: whole(f, 'matchRequired'), matchCommitted: whole(f, 'matchCommitted') }
  if (Object.values(nums).includes('bad')) return { error: 'Amounts are whole dollars, such as 250000.' }
  const dueRaw = str(f, 'dueDate')
  const dueDate = dueRaw ? new Date(`${dueRaw}T12:00:00Z`) : null
  if (dueDate && Number.isNaN(dueDate.getTime())) return { error: 'Use a date like 2026-12-02.' }
  const data = {
    name,
    funder: str(f, 'funder').slice(0, 160) || null,
    status,
    amountRequested: nums.amountRequested as number | null,
    amountAwarded: nums.amountAwarded as number | null,
    matchRequired: nums.matchRequired as number | null,
    matchCommitted: nums.matchCommitted as number | null,
    dueDate,
    partners: str(f, 'partners').split(',').map((p) => p.trim()).filter(Boolean).slice(0, 12),
    notes: str(f, 'notes').slice(0, 2000) || null,
  }
  if (id) {
    const own = await prisma.fundingApplication.findFirst({ where: { id, institutionId: ctx.institution.id }, select: { id: true } })
    if (!own) return { error: 'That application was not found.' }
    await prisma.fundingApplication.update({ where: { id }, data })
  } else {
    await prisma.fundingApplication.create({ data: { ...data, institutionId: ctx.institution.id, createdBy: ctx.userId } })
  }
  captureServerEvent(ctx.userId, id ? 'funding_application_updated' : 'funding_application_added', { institutionId: ctx.institution.id, applicationId: id || null, status, funder: data.funder, amountRequested: data.amountRequested })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved.' }
}

// Say which funding application pays for a layoff response ("" clears it).
export async function linkResponseFunding(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const responseId = str(f, 'responseId')
  const fundingId = str(f, 'fundingId')
  const r = await prisma.rapidResponse.findFirst({ where: { id: responseId, institutionId: ctx.institution.id }, select: { id: true } })
  if (!r) return { error: 'That layoff response was not found.' }
  if (fundingId) {
    const own = await prisma.fundingApplication.findFirst({ where: { id: fundingId, institutionId: ctx.institution.id }, select: { id: true } })
    if (!own) return { error: 'That application was not found.' }
  }
  await prisma.rapidResponse.update({ where: { id: r.id }, data: { fundingApplicationId: fundingId || null } })
  captureServerEvent(ctx.userId, 'layoff_response_funding_linked', { institutionId: ctx.institution.id, rapidResponseId: r.id, applicationId: fundingId || null })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// ── Phase 4: jobs for the organization's group ──────────────────────────────

const GROUP_JOB_DAYS = 60

function groupPostingData(institutionId: string, addedBy: string, p: { title: string; companyName: string; companyId: string | null; location: string | null; url: string; description?: string | null; salaryMin?: number | null; salaryMax?: number | null }) {
  return {
    title: p.title,
    companyName: p.companyName,
    companyId: p.companyId,
    location: p.location,
    url: p.url,
    description: p.description ?? null,
    postingType: 'direct',
    salaryMin: p.salaryMin ?? null,
    salaryMax: p.salaryMax ?? null,
    salaryCurrency: 'USD',
    audienceTier: 'ALL_CANDIDATES',
    distribution: 'OPEN',
    disclosure: 'OPEN',
    // Reviewed by a NextChapter admin before the group sees it, like every posting that is not from our own team.
    status: 'pending',
    source: 'institution',
    addedBy,
    institutionScopeId: institutionId,
    expiresAt: new Date(Date.now() + GROUP_JOB_DAYS * 86_400_000),
  }
}

// Add one job for the group.
export async function addGroupJob(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const title = str(f, 'title').slice(0, 160)
  const companyName = fixAllCapsCompanyName(str(f, 'companyName')).slice(0, 160)
  const url = str(f, 'url')
  if (!title) return { error: 'Add the job title.' }
  if (!companyName) return { error: 'Add the company name.' }
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol')
  } catch {
    return { error: 'Add a real link to the posting, starting with https://.' }
  }
  const salaryMin = str(f, 'salaryMin') ? Number(str(f, 'salaryMin').replace(/[$,]/g, '')) : null
  const salaryMax = str(f, 'salaryMax') ? Number(str(f, 'salaryMax').replace(/[$,]/g, '')) : null
  if ((salaryMin !== null && !Number.isFinite(salaryMin)) || (salaryMax !== null && !Number.isFinite(salaryMax))) return { error: 'Pay is a number, such as 95000.' }
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) return { error: 'The pay minimum cannot be higher than the maximum.' }
  if (await prisma.exclusiveJobPosting.findFirst({ where: { url }, select: { id: true } })) return { error: 'That posting is already on NextChapter.' }
  const p = await prisma.exclusiveJobPosting.create({
    data: groupPostingData(ctx.institution.id, ctx.email ?? 'institution', { title, companyName, companyId: await linkPostingToCompany(companyName), location: str(f, 'location').slice(0, 160) || null, url, description: str(f, 'description').slice(0, 20000) || null, salaryMin, salaryMax }),
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'group_job_added', { institutionId: ctx.institution.id, postingId: p.id, hasPay: salaryMin !== null || salaryMax !== null })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Added. A NextChapter admin reviews it before your group sees it.' }
}

// Add many jobs from a pasted list: title, company, location, link.
export async function importGroupJobs(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const { rows, errors, truncated } = parseJobRows(str(f, 'rows').slice(0, 60_000))
  if (rows.length === 0) return { error: errors[0] ? `Line ${errors[0].line}: ${errors[0].reason}` : 'Paste at least one job: title, company, location, link.' }
  const existing = new Set((await prisma.exclusiveJobPosting.findMany({ where: { url: { in: rows.map((r) => r.url) } }, select: { url: true } })).map((r) => r.url))
  const fresh = rows.filter((r) => !existing.has(r.url))
  const links = new Map<string, string | null>()
  for (const name of new Set(fresh.map((r) => fixAllCapsCompanyName(r.company)))) links.set(name, await linkPostingToCompany(name))
  if (fresh.length > 0) {
    await prisma.exclusiveJobPosting.createMany({
      data: fresh.map((r) => {
        const name = fixAllCapsCompanyName(r.company)
        return groupPostingData(ctx.institution.id, ctx.email ?? 'institution', { title: r.title, companyName: name, companyId: links.get(name) ?? null, location: r.location, url: r.url })
      }),
      skipDuplicates: true,
    })
  }
  captureServerEvent(ctx.userId, 'group_jobs_imported', { institutionId: ctx.institution.id, added: fresh.length, alreadyThere: existing.size, refused: errors.length, truncated })
  revalidatePath(`/i/${slug}`, 'layout')
  const notes = [existing.size ? `${existing.size} already on NextChapter` : null, errors.length ? `${errors.length} line${errors.length === 1 ? '' : 's'} skipped (first: line ${errors[0].line}, ${errors[0].reason.toLowerCase()})` : null, truncated ? 'only the first 100 were read' : null].filter(Boolean)
  return { ok: true, message: `Added ${fresh.length} job${fresh.length === 1 ? '' : 's'} for review.${notes.length ? ` ${notes.join('; ')}.` : ''}` }
}

// Take one of the group's jobs down.
export async function archiveGroupJob(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const id = str(f, 'id')
  const r = await prisma.exclusiveJobPosting.updateMany({ where: { id, institutionScopeId: ctx.institution.id, archivedAt: null }, data: { archivedAt: new Date() } })
  if (r.count === 0) return { error: 'That job was not found.' }
  captureServerEvent(ctx.userId, 'group_job_archived', { institutionId: ctx.institution.id, postingId: id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// ── Phase 5: partner views ──────────────────────────────────────────────────

// Make a read-only view of the organization's regional data for one partner, opened by an unlisted link.
export async function createPartnerView(slug: string, _prev: HubResult, f: FormData): Promise<HubResult & { token?: string }> {
  const ctx = await hub(slug)
  const partnerName = str(f, 'partnerName').slice(0, 120)
  if (!partnerName) return { error: 'Add the name of the college, employer or group this is for.' }
  const kind = str(f, 'partnerKind') || 'OTHER'
  if (!PARTNER_KIND_KEYS.includes(kind)) return { error: 'Pick who this is for.' }
  const scopes = normalizeScopes(f.getAll('scopes').map(String))
  if (scopes.length === 0) return { error: 'Pick at least one thing to include.' }
  const days = Number(str(f, 'days')) === 90 ? 90 : 30
  const token = randomBytes(24).toString('base64url')
  const v = await prisma.partnerView.create({
    data: { institutionId: ctx.institution.id, token, partnerName, partnerKind: kind, scopes, note: str(f, 'note').slice(0, 500) || null, expiresAt: new Date(Date.now() + days * 86_400_000), createdBy: ctx.userId },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'partner_view_created', { institutionId: ctx.institution.id, viewId: v.id, partnerKind: kind, scopes, days })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `Made. Copy the link from the list below and send it to ${partnerName}.`, token }
}

// Switch a partner view off. The link stops working at once.
export async function revokePartnerView(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const id = str(f, 'id')
  const r = await prisma.partnerView.updateMany({ where: { id, institutionId: ctx.institution.id, revokedAt: null }, data: { revokedAt: new Date() } })
  if (r.count === 0) return { error: 'That view was not found, or is already switched off.' }
  captureServerEvent(ctx.userId, 'partner_view_revoked', { institutionId: ctx.institution.id, viewId: id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// ── Phase 6: the ecosystem directory, invitations and claims ────────────────

const eco = (ctx: { institution: { id: string } }, id: string) => prisma.ecosystemPartner.findFirst({ where: { id, institutionId: ctx.institution.id } })

// Add an organization to the directory by hand.
export async function addEcosystemPartner(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const name = str(f, 'name').slice(0, 160)
  if (!name) return { error: 'Add the organization’s name.' }
  const kind = ECO_KIND_KEYS.includes(str(f, 'kind')) ? str(f, 'kind') : 'OTHER'
  const website = str(f, 'website').slice(0, 200) || null
  const p = await prisma.ecosystemPartner.create({ data: { institutionId: ctx.institution.id, name, kind, website, source: 'MANUAL', createdBy: ctx.userId }, select: { id: true } })
  captureServerEvent(ctx.userId, 'ecosystem_partner_added', { institutionId: ctx.institution.id, partnerId: p.id, kind, how: 'manual' })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Added to the directory.' }
}

// Fill the directory from data we already have: the colleges in your region (federal data) and your member companies.
export async function seedEcosystem(slug: string, _prev: HubResult, _f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const id = ctx.institution.id
  const [colleges, companies] = await Promise.all([nearbyColleges(id).catch(() => []), prisma.memberCompany.findMany({ where: { institutionId: id }, take: 200, select: { id: true, name: true } })])
  const data = [
    ...colleges.map((c) => ({ institutionId: id, name: c.name, kind: 'COLLEGE', website: c.website ?? null, source: 'COLLEGE_DATA', refId: c.unitid, createdBy: ctx.userId })),
    ...companies.map((c) => ({ institutionId: id, name: c.name, kind: 'EMPLOYER', website: null, source: 'MEMBER_COMPANY', refId: c.id, createdBy: ctx.userId })),
  ]
  const r = data.length ? await prisma.ecosystemPartner.createMany({ data, skipDuplicates: true }) : { count: 0 }
  captureServerEvent(ctx.userId, 'ecosystem_seeded', { institutionId: id, added: r.count, colleges: colleges.length, companies: companies.length })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: r.count ? `Added ${r.count} organizations from public data and your member companies.` : 'Nothing new to add: they are all in the directory.' }
}

// Make (or remake) the invitation link for one partner.
export async function createInvite(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const p = await eco(ctx, str(f, 'id'))
  if (!p) return { error: 'That organization was not found.' }
  if (!canInvite(p.status)) return { error: 'This organization is already confirmed.' }
  await prisma.ecosystemPartner.update({ where: { id: p.id }, data: { inviteToken: p.inviteToken ?? randomBytes(24).toString('base64url'), status: 'INVITED', invitedAt: new Date() } })
  captureServerEvent(ctx.userId, 'ecosystem_invite_created', { institutionId: ctx.institution.id, partnerId: p.id, kind: p.kind })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Link made. Copy the message or the link below and send it yourself.' }
}

// Confirm or decline a partner that asked to join.
export async function decideClaim(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const p = await eco(ctx, str(f, 'id'))
  if (!p) return { error: 'That organization was not found.' }
  if (!canDecide(p.status)) return { error: 'Nothing to decide here.' }
  const confirm = str(f, 'decision') === 'confirm'
  await prisma.ecosystemPartner.update({ where: { id: p.id }, data: { status: confirm ? 'CONFIRMED' : 'DECLINED', decidedAt: new Date(), decidedBy: ctx.userId } })
  captureServerEvent(ctx.userId, confirm ? 'ecosystem_claim_confirmed' : 'ecosystem_claim_declined', { institutionId: ctx.institution.id, partnerId: p.id, kind: p.kind, commitments: p.commitments, domainMatch: p.emailDomainMatch })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// Remove an organization from the directory.
export async function removeEcosystemPartner(slug: string, _prev: HubResult, f: FormData): Promise<HubResult> {
  const ctx = await hub(slug)
  const r = await prisma.ecosystemPartner.deleteMany({ where: { id: str(f, 'id'), institutionId: ctx.institution.id } })
  if (r.count === 0) return { error: 'That organization was not found.' }
  captureServerEvent(ctx.userId, 'ecosystem_partner_removed', { institutionId: ctx.institution.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}
