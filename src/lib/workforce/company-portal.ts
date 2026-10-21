// A member company's own view of its workforce org's portal ("Your
// company"): its layoffs and seats, how its people are doing (counts only,
// under five hidden, never a name or any one person's search), its hiring
// access, and seat requests the org approves.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { employerProfileFor } from '@/lib/higher-ed/employers'
import type { InstitutionAccess } from '@/lib/higher-ed/resolve'
import { localArea, readLocal } from './local'
import { keptShare, splitByPlace } from './hub'

type Ctx = Pick<InstitutionAccess, 'employerProfileIds' | 'isNcAdmin' | 'institution'> & { mode?: InstitutionAccess['mode'] }

// The member company this request acts as (a demo preview: the first connected one).
export async function memberCompanyFor(ctx: Ctx) {
  const employerProfileId = await employerProfileFor(ctx)
  const where = employerProfileId ? { institutionId: ctx.institution.id, employerProfileId } : null
  const select = { id: true, name: true, hiring: true, industry: true, city: true, state: true } as const
  const c = where ? await prisma.memberCompany.findFirst({ where, select }) : null
  if (c || !ctx.institution.isDemo || !(ctx.isNcAdmin || ctx.mode === 'demo-guest')) return c
  return prisma.memberCompany.findFirst({ where: { institutionId: ctx.institution.id, employerProfileId: { not: null } }, orderBy: { name: 'asc' }, select })
}

export async function companyOverview(institutionId: string, companyId: string) {
  const [inst, layoffs, people] = await Promise.all([
    prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true } }),
    prisma.rapidResponse.findMany({
      where: { institutionId, memberCompanyId: companyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, seats: true, isActive: true, requestStatus: true, requestNote: true, requestedAt: true, createdAt: true, _count: { select: { participants: true } } },
    }),
    prisma.institutionMember.findMany({
      where: { institutionId, memberCompanyId: companyId, affiliation: 'PARTICIPANT', status: { not: 'OPTED_OUT' } },
      select: {
        candidateId: true,
        candidate: { select: { journeyStage: true } },
        consents: { where: { scope: 'SHARE_OUTCOME' }, orderBy: { changedAt: 'desc' }, take: 1, select: { granted: true } },
      },
    }),
  ])
  const sharing = people.filter((p) => p.candidateId && p.consents[0]?.granted).map((p) => p.candidateId!)
  const hires = sharing.length
    ? await prisma.hireOutcome.findMany({ where: { candidateId: { in: sharing } }, orderBy: { hiredAt: 'desc' }, distinct: ['candidateId'], select: { workCity: true, workState: true, workRemote: true } })
    : []
  const settings = readLocal(inst.enabledFeatures)
  const split = splitByPlace(hires, settings ? await localArea(settings) : null)
  return {
    layoffs,
    signedUp: people.length,
    joined: people.filter((p) => p.candidateId).length,
    searching: people.filter((p) => p.candidate?.journeyStage && ['APPLYING', 'INTERVIEWING', 'OFFER'].includes(p.candidate.journeyStage)).length,
    landed: hires.length,
    kept: keptShare(split),
    regionLabel: settings?.label ?? 'the region',
  }
}

export async function requestSeats(args: { institutionId: string; companyId: string; seats: number; note: string; by: string }) {
  if (!Number.isInteger(args.seats) || args.seats < 1 || args.seats > 5000) return { error: 'Ask for 1 to 5,000 seats.' }
  const open = await prisma.rapidResponse.count({ where: { institutionId: args.institutionId, memberCompanyId: args.companyId, requestStatus: 'REQUESTED' } })
  if (open) return { error: 'You already have a request waiting. The organization will answer it first.' }
  const c = await prisma.memberCompany.findFirstOrThrow({ where: { id: args.companyId, institutionId: args.institutionId }, select: { name: true } })
  const r = await prisma.rapidResponse.create({
    data: {
      institutionId: args.institutionId,
      memberCompanyId: args.companyId,
      seats: args.seats,
      employerName: c.name,
      title: `Free career support for ${c.name} employees`,
      message: '',
      programIds: [],
      isActive: false,
      requestStatus: 'REQUESTED',
      requestNote: args.note.trim().slice(0, 1000) || null,
      requestedAt: new Date(),
      createdBy: args.by,
    },
    select: { id: true },
  })
  return { id: r.id }
}

// The org answers a request: approve (with the seats it gives) or decline.
export async function answerSeatRequest(args: { institutionId: string; id: string; approve: boolean; seats?: number; orgBrand: string }) {
  const r = await prisma.rapidResponse.findFirst({ where: { id: args.id, institutionId: args.institutionId, requestStatus: 'REQUESTED' }, select: { id: true, seats: true, employerName: true } })
  if (!r) return { error: 'That request was already answered.' }
  if (!args.approve) {
    await prisma.rapidResponse.update({ where: { id: r.id }, data: { requestStatus: 'DECLINED' } })
    return { ok: true }
  }
  const seats = args.seats ?? r.seats ?? 0
  if (!Number.isInteger(seats) || seats < 1) return { error: 'Give at least one seat.' }
  const [inst, given] = await Promise.all([
    prisma.institution.findUniqueOrThrow({ where: { id: args.institutionId }, select: { includedSeats: true } }),
    prisma.rapidResponse.aggregate({ where: { institutionId: args.institutionId, isActive: true, memberCompanyId: { not: null } }, _sum: { seats: true } }),
  ])
  const left = inst.includedSeats - (given._sum.seats ?? 0)
  if (seats > left) return { error: `Only ${Math.max(left, 0).toLocaleString()} seats are left in your pool.` }
  await prisma.rapidResponse.update({
    where: { id: r.id },
    data: {
      requestStatus: 'APPROVED',
      isActive: true,
      seats,
      message: `${args.orgBrand} is giving people affected by the ${r.employerName} layoff free access to NextChapter: an honest read on your job market, a plan for each week, coaching, and local employers who are hiring. Sign up below to claim your seat.`,
    },
  })
  return { ok: true }
}
