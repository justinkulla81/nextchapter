// Class notes, job-search circles, the virtual career fair and alumni
// referrals. Names other alumni see are their own choice (joined members);
// employers see a fair visitor's Dossier only when the alum shared it.

import 'server-only'
import { prisma } from '@/lib/prisma'

const DAY = 86_400_000
const full = (f: string | null, l: string | null) => [f, l].filter(Boolean).join(' ') || 'An alum'
const yr = (y: number | null) => (y ? ` ’${String(y).slice(2)}` : '')

// ── Class notes ──────────────────────────────────────────────────────────────

export const NOTE_KINDS = [
  { key: 'career', label: 'Career news' },
  { key: 'life', label: 'Life news' },
  { key: 'achievement', label: 'An achievement' },
  { key: 'other', label: 'Something else' },
] as const

export async function postClassNote(institutionId: string, memberId: string, kind: string, body: string) {
  const text = body.trim()
  if (text.length < 10) return { error: 'Write a sentence or two.' }
  if (!NOTE_KINDS.some((k) => k.key === kind)) return { error: 'Pick what kind of news it is.' }
  const today = await prisma.classNote.count({ where: { memberId, createdAt: { gte: new Date(Date.now() - DAY) } } })
  if (today >= 2) return { error: 'Two notes a day at most. Post again tomorrow.' }
  await prisma.classNote.create({ data: { institutionId, memberId, kind, body: text.slice(0, 1000) } })
  return { ok: true }
}

// Newest first; `classYear` narrows to one class.
export async function listClassNotes(institutionId: string, opts: { classYear?: number | null; limit?: number; includeHidden?: boolean } = {}) {
  const rows = await prisma.classNote.findMany({
    where: { institutionId, ...(opts.includeHidden ? {} : { hiddenAt: null }), ...(opts.classYear ? { member: { classYear: opts.classYear } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 40,
    include: { member: { select: { firstName: true, lastName: true, classYear: true } } },
  })
  return rows.map((r) => ({ id: r.id, kind: r.kind, body: r.body, createdAt: r.createdAt, hidden: !!r.hiddenAt, who: `${full(r.member.firstName, r.member.lastName)}${yr(r.member.classYear)}`, classYear: r.member.classYear }))
}

// ── Job-search circles ───────────────────────────────────────────────────────

export async function openCircles(institutionId: string, memberId: string | null) {
  const rows = await prisma.jobSearchCircle.findMany({
    where: { institutionId, startsAt: { gte: new Date(Date.now() - 60 * DAY) } },
    orderBy: { startsAt: 'asc' },
    include: { _count: { select: { members: true } }, members: memberId ? { where: { memberId }, select: { id: true } } : false },
  })
  return rows.map(({ members, ...c }) => {
    const ends = new Date(c.startsAt.getTime() + c.weeks * 7 * DAY)
    return { ...c, endsAt: ends, full: c._count.members >= c.capacity, joined: ((members as { id: string }[] | undefined) ?? []).length > 0, started: c.startsAt.getTime() < Date.now() }
  })
}

export async function joinCircle(circleId: string, memberId: string, goal: string, leave = false) {
  if (leave) {
    await prisma.jobSearchCircleMember.deleteMany({ where: { circleId, memberId } })
    return { ok: true }
  }
  const c = await prisma.jobSearchCircle.findUnique({ where: { id: circleId }, select: { capacity: true, startsAt: true, _count: { select: { members: true } } } })
  if (!c) return { error: 'That circle is gone.' }
  if (c._count.members >= c.capacity) return { error: 'That circle is full. Try another, or ask to be told when a new one opens.' }
  await prisma.jobSearchCircleMember.upsert({ where: { circleId_memberId: { circleId, memberId } }, create: { circleId, memberId, goal: goal.trim().slice(0, 300) || null }, update: { goal: goal.trim().slice(0, 300) || null } })
  return { ok: true }
}

// ── Virtual career fair ──────────────────────────────────────────────────────

export async function careerFairs(institutionId: string, memberId: string | null) {
  const events = await prisma.collegeEvent.findMany({
    where: { institutionId, kind: 'career_fair', cancelledAt: null, startsAt: { gte: new Date(Date.now() - 14 * DAY) } },
    orderBy: { startsAt: 'asc' },
    include: { booths: { orderBy: { employerName: 'asc' }, include: { _count: { select: { visits: true } }, visits: memberId ? { where: { memberId }, select: { id: true } } : false } } },
  })
  return events.map((e) => ({
    ...e,
    booths: e.booths.map(({ visits, ...b }) => ({ ...b, visited: ((visits as { id: string }[] | undefined) ?? []).length > 0 })),
  }))
}

export async function visitBooth(boothId: string, memberId: string, note: string, shareDossier: boolean) {
  const b = await prisma.fairBooth.findUnique({ where: { id: boothId }, select: { id: true } })
  if (!b) return { error: 'That booth is gone.' }
  await prisma.fairBoothVisit.upsert({
    where: { boothId_memberId: { boothId, memberId } },
    create: { boothId, memberId, note: note.trim().slice(0, 500) || null, shareDossier },
    update: { note: note.trim().slice(0, 500) || null, shareDossier },
  })
  return { ok: true }
}

// For staff and the booth's employer: who stopped by.
export async function boothVisitors(boothId: string) {
  const rows = await prisma.fairBoothVisit.findMany({
    where: { boothId },
    orderBy: { createdAt: 'asc' },
    include: { member: { select: { firstName: true, lastName: true, classYear: true, email: true, candidateId: true } } },
  })
  return rows.map((v) => ({ id: v.id, name: `${full(v.member.firstName, v.member.lastName)}${yr(v.member.classYear)}`, email: v.member.email, note: v.note, shareDossier: v.shareDossier, candidateId: v.shareDossier ? v.member.candidateId : null }))
}

// ── Referrals ────────────────────────────────────────────────────────────────

// The alum who was asked marks that they referred them.
export async function markReferred(targetMemberId: string, introId: string) {
  const r = await prisma.alumniIntroRequest.updateMany({ where: { id: introId, targetMemberId, purpose: 'referral', status: 'ACCEPTED' }, data: { referredAt: new Date() } })
  return r.count ? { ok: true } : { error: 'Accept the request first, then mark it referred.' }
}
