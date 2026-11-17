'use server'

// "Your company" (a workforce org's member company): ask for layoff seats
// and say whether it's hiring.

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '@/lib/posthog/server'
import { employerRoleError, requireEmployerRole } from '@/lib/higher-ed/access'
import type { EmployerRole } from '@/lib/higher-ed/workspaces'
import { prisma } from '@/lib/prisma'
import { memberCompanyFor, requestSeats } from '@/lib/workforce/company-portal'
import { offerCollaboration, offerGrantSupport, requestTraining } from '@/lib/workforce/company-requests'

type Result = { error?: string; ok?: boolean; message?: string } | undefined

async function company(slug: string, role: EmployerRole) {
  const ctx = await requireEmployerRole(slug, role)
  if (!ctx) return { roleError: employerRoleError(role) }
  const c = await memberCompanyFor(ctx)
  return c ? { ctx, c } : null
}

export async function requestSeatsAction(slug: string, _prev: Result, f: FormData): Promise<Result> {
  const r0 = await company(slug, 'outplacement')
  if (r0 && 'roleError' in r0) return { error: r0.roleError }
  if (!r0) return { error: 'Your login isn’t connected to a member company. Ask the organization for an invite.' }
  const seats = Number(String(f.get('seats') ?? ''))
  const r = await requestSeats({ institutionId: r0.ctx.institution.id, companyId: r0.c.id, seats, note: String(f.get('note') ?? ''), by: r0.ctx.email ?? r0.ctx.userId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(r0.ctx.userId, 'company_seats_requested', { institutionId: r0.ctx.institution.id, companyId: r0.c.id, seats })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `Request sent. ${r0.ctx.institution.name} will answer it, and the sign-up page appears here once seats are approved.` }
}

export async function setOwnHiring(slug: string, hiring: boolean): Promise<{ error?: string }> {
  const r0 = await company(slug, 'hiring')
  if (r0 && 'roleError' in r0) return { error: r0.roleError }
  if (!r0) return { error: 'Your login isn’t connected to a member company.' }
  await prisma.memberCompany.update({ where: { id: r0.c.id }, data: { hiring } })
  captureServerEvent(r0.ctx.userId, 'company_hiring_set', { institutionId: r0.ctx.institution.id, companyId: r0.c.id, hiring })
  revalidatePath(`/i/${slug}`, 'layout')
  return {}
}

// Learning and development: ask the organization for training for the company's people.
export async function requestTrainingAction(slug: string, _prev: Result, f: FormData): Promise<Result> {
  const r0 = await company(slug, 'learning')
  if (r0 && 'roleError' in r0) return { error: r0.roleError }
  if (!r0) return { error: 'Your login isn’t connected to a member company. Ask the organization for an invite.' }
  const peopleRaw = String(f.get('people') ?? '').trim()
  const people = peopleRaw ? Number(peopleRaw) : null
  const r = await requestTraining({ institutionId: r0.ctx.institution.id, companyId: r0.c.id, topic: String(f.get('topic') ?? ''), people, note: String(f.get('note') ?? ''), by: r0.ctx.email ?? r0.ctx.userId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(r0.ctx.userId, 'company_training_requested', { institutionId: r0.ctx.institution.id, companyId: r0.c.id, requestId: r.id, people })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `Sent. ${r0.ctx.institution.name} will answer it here.` }
}

// Grants and RFPs: offer support for one of the organization's applications, or for a grant the company has in mind.
export async function offerGrantSupportAction(slug: string, _prev: Result, f: FormData): Promise<Result> {
  const r0 = await company(slug, 'grants')
  if (r0 && 'roleError' in r0) return { error: r0.roleError }
  if (!r0) return { error: 'Your login isn’t connected to a member company. Ask the organization for an invite.' }
  const matchRaw = String(f.get('matchAmount') ?? '').replace(/[$,\s]/g, '')
  const fundingApplicationId = String(f.get('fundingApplicationId') ?? '') || null
  const r = await offerGrantSupport({
    institutionId: r0.ctx.institution.id,
    companyId: r0.c.id,
    companyName: r0.c.name,
    fundingApplicationId,
    topic: String(f.get('topic') ?? ''),
    offers: f.getAll('offers').map(String),
    matchAmount: matchRaw ? Number(matchRaw) : null,
    note: String(f.get('note') ?? ''),
    by: r0.ctx.email ?? r0.ctx.userId,
  })
  if ('error' in r) return { error: r.error }
  captureServerEvent(r0.ctx.userId, 'company_grant_support_offered', { institutionId: r0.ctx.institution.id, companyId: r0.c.id, requestId: r.id, fundingApplicationId, offers: r.offers })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `Sent. ${r0.ctx.institution.name} will answer it here.` }
}

// Workforce development (role "workforce") or college partnerships (role "colleges"): what the company offers to do.
export async function offerCollaborationAction(slug: string, kind: 'WORKFORCE_COLLAB' | 'COLLEGE_COLLAB', _prev: Result, f: FormData): Promise<Result> {
  const role = kind === 'WORKFORCE_COLLAB' ? 'workforce' : 'colleges'
  const r0 = await company(slug, role)
  if (r0 && 'roleError' in r0) return { error: r0.roleError }
  if (!r0) return { error: 'Your login isn’t connected to a member company. Ask the organization for an invite.' }
  const peopleRaw = String(f.get('people') ?? '').trim()
  const people = peopleRaw ? Number(peopleRaw) : null
  const r = await offerCollaboration({ kind, institutionId: r0.ctx.institution.id, companyId: r0.c.id, offers: f.getAll('offers').map(String), topic: String(f.get('topic') ?? ''), people, note: String(f.get('note') ?? ''), by: r0.ctx.email ?? r0.ctx.userId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(r0.ctx.userId, kind === 'WORKFORCE_COLLAB' ? 'company_workforce_partnership_offered' : 'company_college_partnership_offered', { institutionId: r0.ctx.institution.id, companyId: r0.c.id, requestId: r.id, offers: r.offers, people })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `Sent. ${r0.ctx.institution.name} will answer it here.` }
}
