import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { isActiveMember } from '@/lib/membership/subscription'
import { servicesForPackage } from '@/lib/employer/program-settings'

// What a person can use beyond the free product: their own membership, plus
// grants (an outplacement seat, a coach's code, a coach, an admin). A grant
// is live when not revoked and inside startsAt..endsAt; coaching grants carry
// sessions that count down as the coach logs them.

export type Feature = 'coaching' | 'recruiters'
export type GrantSource = 'outplacement_seat' | 'coach_code' | 'coach' | 'admin'

const live = (now: Date) => ({ revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] })

export type Access = {
  member: boolean
  coaching: { on: boolean; sessionsLeft: number | null; endsAt: Date | null; via: GrantSource | 'membership' | null; grantId: string | null }
  recruiters: { on: boolean; endsAt: Date | null; via: GrantSource | 'membership' | null }
}

export async function accessFor(candidateId: string, now = new Date()): Promise<Access> {
  const [member, grants] = await Promise.all([
    isActiveMember(candidateId).catch(() => false),
    prisma.accessGrant.findMany({ where: { candidateId, ...live(now) }, orderBy: { createdAt: 'asc' } }).catch(() => []),
  ])
  // Coaching: the grant with sessions left (oldest first), else any unlimited one.
  const coachingGrants = grants.filter((g) => g.feature === 'coaching')
  const withLeft = coachingGrants.find((g) => g.sessionsTotal === null || g.sessionsUsed < g.sessionsTotal)
  const left = coachingGrants.reduce<number | null>((n, g) => (g.sessionsTotal === null ? n : (n ?? 0) + Math.max(0, g.sessionsTotal - g.sessionsUsed)), null)
  const unlimited = coachingGrants.some((g) => g.sessionsTotal === null)
  const rec = grants.find((g) => g.feature === 'recruiters')
  return {
    member,
    coaching: {
      on: member || !!withLeft,
      sessionsLeft: unlimited ? null : left,
      endsAt: withLeft?.endsAt ?? null,
      via: withLeft ? (withLeft.source as GrantSource) : member ? 'membership' : null,
      grantId: withLeft?.id ?? null,
    },
    recruiters: { on: member || !!rec, endsAt: rec?.endsAt ?? null, via: rec ? (rec.source as GrantSource) : member ? 'membership' : null },
  }
}

// ── Outplacement seats ───────────────────────────────────────────────────────

const SESSIONS_BY_TIER: Record<string, number | null> = { CORE: 0, PLUS: 6, PREMIUM: 12 }

// Grants what this seat's contract tier and package include, from NextChapter
// (coaching with the tier's sessions; the recruiter network), until the
// person's access end or the contract's. Idempotent; keeps sessions already
// used and any manual override (a revoked grant stays revoked).
export async function grantSeatAccess(seatId: string, createdBy = 'seat-activation', opts: { prune?: boolean } = {}) {
  const seat = await prisma.outplacementSeat.findUnique({
    where: { id: seatId },
    select: { id: true, candidateId: true, status: true, packageKey: true, accessEndsAt: true, contract: { select: { tier: true, termEndAt: true, termStartAt: true, org: { select: { programSettings: true } } } } },
  })
  if (!seat?.candidateId || seat.status !== 'ACTIVATED') return { granted: [] as Feature[] }
  const offered = servicesForPackage(seat.contract.org.programSettings, seat.contract.tier, seat.packageKey).filter((s) => s.provider === 'nextchapter')
  const endsAt = seat.accessEndsAt ?? seat.contract.termEndAt
  const want: { feature: Feature; sessionsTotal: number | null }[] = []
  if (offered.some((s) => s.key === 'coaching') && (SESSIONS_BY_TIER[seat.contract.tier] ?? 0) > 0) want.push({ feature: 'coaching', sessionsTotal: SESSIONS_BY_TIER[seat.contract.tier] ?? null })
  if (offered.some((s) => s.key === 'recruiters')) want.push({ feature: 'recruiters', sessionsTotal: null })
  for (const w of want) {
    const existing = await prisma.accessGrant.findFirst({ where: { source: 'outplacement_seat', sourceId: seat.id, feature: w.feature } })
    if (existing) {
      // Keep overrides: only move the end date with the seat or contract.
      await prisma.accessGrant.update({ where: { id: existing.id }, data: { endsAt } })
    } else {
      await prisma.accessGrant.create({ data: { candidateId: seat.candidateId, feature: w.feature, source: 'outplacement_seat', sourceId: seat.id, sessionsTotal: w.sessionsTotal, endsAt, createdBy } })
    }
  }
  // A package change: what the new package no longer includes stops.
  if (opts.prune) {
    await prisma.accessGrant.updateMany({
      where: { source: 'outplacement_seat', sourceId: seat.id, revokedAt: null, feature: { notIn: want.map((w) => w.feature) } },
      data: { revokedAt: new Date(), revokedBy: createdBy },
    })
  }
  return { granted: want.map((w) => w.feature) }
}

// Every live grant on one person, for override screens.
export async function grantsFor(candidateId: string) {
  return prisma.accessGrant.findMany({ where: { candidateId }, orderBy: { createdAt: 'desc' } })
}

// The seat grants for a set of seats, keyed by seat id.
export async function seatGrants(seatIds: string[]) {
  const rows = seatIds.length ? await prisma.accessGrant.findMany({ where: { source: 'outplacement_seat', sourceId: { in: seatIds } } }) : []
  const out = new Map<string, typeof rows>()
  for (const r of rows) out.set(r.sourceId!, [...(out.get(r.sourceId!) ?? []), r])
  return out
}

export async function revokeSeatAccess(seatId: string, by: string) {
  await prisma.accessGrant.updateMany({ where: { source: 'outplacement_seat', sourceId: seatId, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: by } })
}

// ── Manual overrides (employer admin, NextChapter admin, coach) ─────────────

export async function setGrantOn(grantId: string, on: boolean, by: string) {
  await prisma.accessGrant.update({ where: { id: grantId }, data: on ? { revokedAt: null, revokedBy: null } : { revokedAt: new Date(), revokedBy: by } })
}

// Turn a seat's feature on or off by hand. Off revokes; on reopens the grant,
// or creates it when the package never included it.
export async function setSeatFeature(seatId: string, feature: Feature, on: boolean, by: string, sessionsTotal: number | null = null) {
  const seat = await prisma.outplacementSeat.findUnique({ where: { id: seatId }, select: { candidateId: true, accessEndsAt: true, contract: { select: { termEndAt: true } } } })
  if (!seat?.candidateId) return { error: 'This person hasn’t joined yet. Turn it on once they have.' }
  const g = await prisma.accessGrant.findFirst({ where: { source: 'outplacement_seat', sourceId: seatId, feature } })
  if (g) await setGrantOn(g.id, on, by)
  else if (on) await prisma.accessGrant.create({ data: { candidateId: seat.candidateId, feature, source: 'outplacement_seat', sourceId: seatId, sessionsTotal: feature === 'coaching' ? (sessionsTotal ?? 6) : null, endsAt: seat.accessEndsAt ?? seat.contract.termEndAt, createdBy: by, note: 'turned on by hand' } })
  return { ok: true }
}

export async function setGrantSessions(grantId: string, sessionsTotal: number | null, by: string) {
  const g = await prisma.accessGrant.findUniqueOrThrow({ where: { id: grantId }, select: { sessionsUsed: true, note: true } })
  const total = sessionsTotal === null ? null : Math.max(g.sessionsUsed, Math.floor(sessionsTotal))
  await prisma.accessGrant.update({ where: { id: grantId }, data: { sessionsTotal: total, note: `${g.note ? `${g.note} · ` : ''}sessions set to ${total ?? 'unlimited'} by ${by}`.slice(0, 500) } })
}

// A coach logging a session: count it against the client's coaching grant
// (that coach's own grant first). Never goes below zero; no grant = nothing.
export async function countCoachingSession(candidateId: string, coachId: string, now = new Date()) {
  const grants = await prisma.accessGrant.findMany({ where: { candidateId, feature: 'coaching', ...live(now) }, orderBy: [{ createdAt: 'asc' }] })
  const g = grants.find((x) => x.coachId === coachId && (x.sessionsTotal === null || x.sessionsUsed < x.sessionsTotal)) ?? grants.find((x) => x.sessionsTotal === null || x.sessionsUsed < x.sessionsTotal)
  if (!g) return null
  await prisma.accessGrant.update({ where: { id: g.id }, data: { sessionsUsed: { increment: 1 } } })
  return g.sessionsTotal === null ? null : g.sessionsTotal - g.sessionsUsed - 1
}

// ── Coach codes ──────────────────────────────────────────────────────────────

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

export function newCode(): string {
  const b = randomBytes(8)
  return `NC-${[...b].map((x) => ALPHABET[x % ALPHABET.length]).join('').replace(/(.{4})(.{4})/, '$1-$2')}`
}

export async function revokeCoachCode(coachId: string, codeId: string) {
  const r = await prisma.coachAccessCode.updateMany({ where: { id: codeId, coachId, revokedAt: null }, data: { revokedAt: new Date() } })
  return r.count ? { ok: true } : { error: 'That code is already off.' }
}

export async function createCoachCode(coachId: string, args: { sessions: number; validDays: number | null; maxUses: number; note: string | null }) {
  if (!(args.sessions >= 1 && args.sessions <= 100)) return { error: 'Sessions must be between 1 and 100.' }
  if (!(args.maxUses >= 1 && args.maxUses <= 500)) return { error: 'Uses must be between 1 and 500.' }
  for (let i = 0; i < 5; i++) {
    const code = newCode()
    try {
      const row = await prisma.coachAccessCode.create({ data: { coachId, code, sessions: Math.floor(args.sessions), validDays: args.validDays, maxUses: Math.floor(args.maxUses), note: args.note?.slice(0, 200) || null }, select: { id: true, code: true } })
      return row
    } catch {
      // collision: try another
    }
  }
  return { error: 'Couldn’t make a unique code. Try again.' }
}

// The client redeems a code: linked to the coach (if they have none yet) and
// granted the sessions. One redemption per person per code.
export async function redeemCoachCode(candidateId: string, raw: string, now = new Date()) {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '')
  const c = await prisma.coachAccessCode.findUnique({ where: { code } })
  if (!c || c.revokedAt || (c.expiresAt && c.expiresAt <= now)) return { error: 'That code isn’t valid. Check it with your coach.' }
  if (c.uses >= c.maxUses) return { error: 'That code has been used up. Ask your coach for a new one.' }
  const already = await prisma.accessGrant.findFirst({ where: { candidateId, source: 'coach_code', sourceId: c.id } })
  if (already) return { error: 'You’ve already used this code.' }
  const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId }, select: { coachId: true } })
  if (profile.coachId && profile.coachId !== c.coachId) return { error: 'You already work with a different coach. Ask support to switch you first.' }
  await prisma.$transaction([
    prisma.coachAccessCode.update({ where: { id: c.id }, data: { uses: { increment: 1 } } }),
    prisma.accessGrant.create({ data: { candidateId, feature: 'coaching', source: 'coach_code', sourceId: c.id, coachId: c.coachId, sessionsTotal: c.sessions, endsAt: c.validDays ? new Date(now.getTime() + c.validDays * 86_400_000) : null, createdBy: 'code' } }),
    ...(profile.coachId ? [] : [prisma.candidateProfile.update({ where: { id: candidateId }, data: { coachId: c.coachId } })]),
  ])
  return { ok: true, sessions: c.sessions }
}

// A coach grants or tops up sessions for one of their own clients directly.
export async function coachSetSessions(coachId: string, candidateId: string, sessionsLeft: number, validDays: number | null, by: string) {
  const client = await prisma.candidateProfile.findFirst({ where: { id: candidateId, coachId }, select: { id: true } })
  if (!client) return { error: 'That person isn’t your client.' }
  if (!(sessionsLeft >= 0 && sessionsLeft <= 200)) return { error: 'Sessions must be between 0 and 200.' }
  const existing = await prisma.accessGrant.findFirst({ where: { candidateId, coachId, source: 'coach', revokedAt: null } })
  const endsAt = validDays ? new Date(Date.now() + validDays * 86_400_000) : null
  if (existing) await prisma.accessGrant.update({ where: { id: existing.id }, data: { sessionsTotal: existing.sessionsUsed + Math.floor(sessionsLeft), endsAt, note: `set by ${by}` } })
  else await prisma.accessGrant.create({ data: { candidateId, feature: 'coaching', source: 'coach', coachId, sessionsTotal: Math.floor(sessionsLeft), endsAt, createdBy: by } })
  return { ok: true }
}
