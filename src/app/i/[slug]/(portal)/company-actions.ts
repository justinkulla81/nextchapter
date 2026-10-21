'use server'

// "Your company" (a workforce org's member company): ask for layoff seats
// and say whether it's hiring.

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { memberCompanyFor, requestSeats } from '@/lib/workforce/company-portal'

type Result = { error?: string; ok?: boolean; message?: string } | undefined

async function company(slug: string) {
  const ctx = await requireWorkspace(slug, 'employer', { write: true })
  const c = await memberCompanyFor(ctx)
  return c ? { ctx, c } : null
}

export async function requestSeatsAction(slug: string, _prev: Result, f: FormData): Promise<Result> {
  const r0 = await company(slug)
  if (!r0) return { error: 'Your login isn’t connected to a member company. Ask the organization for an invite.' }
  const seats = Number(String(f.get('seats') ?? ''))
  const r = await requestSeats({ institutionId: r0.ctx.institution.id, companyId: r0.c.id, seats, note: String(f.get('note') ?? ''), by: r0.ctx.email ?? r0.ctx.userId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(r0.ctx.userId, 'company_seats_requested', { institutionId: r0.ctx.institution.id, companyId: r0.c.id, seats })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `Request sent. ${r0.ctx.institution.name} will answer it, and the sign-up page appears here once seats are approved.` }
}

export async function setOwnHiring(slug: string, hiring: boolean): Promise<{ error?: string }> {
  const r0 = await company(slug)
  if (!r0) return { error: 'Your login isn’t connected to a member company.' }
  await prisma.memberCompany.update({ where: { id: r0.c.id }, data: { hiring } })
  captureServerEvent(r0.ctx.userId, 'company_hiring_set', { institutionId: r0.ctx.institution.id, companyId: r0.c.id, hiring })
  revalidatePath(`/i/${slug}`, 'layout')
  return {}
}
