// What a member company asks its workforce org for, outside layoff seats (owner, 2026-11-17): training for its people
// (an L&D contact) and support it offers for a grant or RFP (a grants contact). The org answers from Member companies.
// Every read is bounded and selects a few columns: a handful of rows per company.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { GRANT_OFFERS, type GrantOffer } from './contact-roles'

const REQUEST_SELECT = {
  id: true,
  kind: true,
  topic: true,
  people: true,
  offers: true,
  matchAmount: true,
  fundingApplicationId: true,
  note: true,
  status: true,
  answerNote: true,
  answeredAt: true,
  createdAt: true,
} as const

const clean = (v: string, max: number) => v.trim().replace(/\s+/g, ' ').slice(0, max)

export async function companyRequests(institutionId: string, companyId: string, kind: 'TRAINING' | 'GRANT_PARTNER') {
  return prisma.memberCompanyRequest.findMany({ where: { institutionId, memberCompanyId: companyId, kind }, orderBy: { createdAt: 'desc' }, take: 50, select: REQUEST_SELECT })
}

export async function requestTraining(args: { institutionId: string; companyId: string; topic: string; people: number | null; note: string; by: string }) {
  const topic = clean(args.topic, 160)
  if (!topic) return { error: 'Say what skill or course your people need.' }
  if (args.people !== null && (!Number.isInteger(args.people) || args.people < 1 || args.people > 5000)) return { error: 'People to train must be 1 to 5,000, or leave it blank.' }
  const r = await prisma.memberCompanyRequest.create({
    data: { institutionId: args.institutionId, memberCompanyId: args.companyId, kind: 'TRAINING', topic, people: args.people, note: clean(args.note, 1000) || null, requestedBy: args.by },
    select: { id: true },
  })
  return { ok: true as const, id: r.id }
}

// The org's grant applications that list this company as a partner (FundingApplication.partners holds names). An org has
// at most a few dozen applications; read those, narrow, and match the name here.
export async function applicationsNaming(institutionId: string, companyName: string) {
  const key = companyName.trim().toLowerCase()
  const apps = await prisma.fundingApplication.findMany({
    where: { institutionId, status: { notIn: ['CLOSED'] } },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: { id: true, name: true, funder: true, status: true, dueDate: true, amountRequested: true, matchRequired: true, matchCommitted: true, partners: true },
  })
  return apps.filter((a) => a.partners.some((p) => p.trim().toLowerCase() === key))
}

export async function offerGrantSupport(args: {
  institutionId: string
  companyId: string
  companyName: string
  fundingApplicationId: string | null
  topic: string
  offers: string[]
  matchAmount: number | null
  note: string
  by: string
}) {
  const offers = GRANT_OFFERS.filter((o) => args.offers.includes(o)) as GrantOffer[]
  if (!offers.length) return { error: 'Pick at least one thing you can offer.' }
  if (args.matchAmount !== null && (!Number.isInteger(args.matchAmount) || args.matchAmount < 1 || args.matchAmount > 100_000_000)) return { error: 'Enter the match in whole dollars, or leave it blank.' }
  let topic = clean(args.topic, 160)
  if (args.fundingApplicationId) {
    const app = (await applicationsNaming(args.institutionId, args.companyName)).find((a) => a.id === args.fundingApplicationId)
    if (!app) return { error: 'That application no longer lists your company. Reload the page.' }
    topic = app.name
  }
  if (!topic) return { error: 'Name the grant or RFP, or the kind of project you would support.' }
  const r = await prisma.memberCompanyRequest.create({
    data: {
      institutionId: args.institutionId,
      memberCompanyId: args.companyId,
      kind: 'GRANT_PARTNER',
      topic,
      offers,
      matchAmount: offers.includes('MATCH') ? args.matchAmount : null,
      fundingApplicationId: args.fundingApplicationId,
      note: clean(args.note, 1000) || null,
      requestedBy: args.by,
    },
    select: { id: true },
  })
  return { ok: true as const, id: r.id, offers }
}

// For the org: requests still waiting for an answer, oldest first.
export async function openCompanyRequests(institutionId: string) {
  return prisma.memberCompanyRequest.findMany({
    where: { institutionId, status: 'REQUESTED' },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: { ...REQUEST_SELECT, memberCompany: { select: { name: true } } },
  })
}

export async function answerCompanyRequest(args: { institutionId: string; id: string; accept: boolean; note: string; by: string }) {
  const r = await prisma.memberCompanyRequest.updateMany({
    where: { id: args.id, institutionId: args.institutionId, status: 'REQUESTED' },
    data: { status: args.accept ? 'ACCEPTED' : 'DECLINED', answerNote: clean(args.note, 1000) || null, answeredBy: args.by, answeredAt: new Date() },
  })
  return r.count ? { ok: true as const } : { error: 'Someone already answered this one. Reload the page.' }
}
