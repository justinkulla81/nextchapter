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
