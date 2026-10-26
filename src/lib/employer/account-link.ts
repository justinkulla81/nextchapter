import 'server-only'
import { createHash, randomBytes } from 'crypto'
import type { PrismaClient } from '@prisma/client'

// "Link my other account" (docs/specs/employer-sections-build-plan.md, section 3.2 and decision 6).
//
// A person who holds employer sections under two sign-in emails proves both once:
//   1. Signed in to account A, they enter address B. We email a single-use token to B (stored hashed, 30 minutes).
//   2. Opening it while signed in as A, and confirming, records the link. Receiving the token proves control of B's inbox,
//      being signed in as A proves A. Only the account that asked (A) can confirm; anyone else gets "wrong user".
//
// A link can NEVER grant access by itself. It only lets getEmployerAccess({ includeLinked: true }) include the other
// account's own grants in the chooser and the bridge. It changes no role, merges nothing, and touches no cookie,
// middleware, proxy or login. Either side can remove it. The pure rules live here with the database passed in, so they
// are tested without a server; the wiring (email, rate limit, events) is in account-link-server.ts.

/** How long the emailed token works. Short on purpose; the owner's ceiling is 7 days. */
export const LINK_TOKEN_TTL_MS = 30 * 60 * 1000

export type LinkDb = Pick<PrismaClient, 'employerAccountLink'>

export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newLinkToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashLinkToken(token) }
}

export function normalizeLinkEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
}

export type LinkTokenState = 'ok' | 'invalid' | 'expired' | 'used' | 'wrong_user'

interface LinkRow {
  userId: string
  status: string
  tokenExpiresAt: Date
}

/** What a token row says about being confirmed by this signed-in person. Pure. */
export function evaluateLinkRow(row: LinkRow | null, userId: string, now: Date): LinkTokenState {
  if (!row) return 'invalid'
  // Only the account that asked may confirm. Anyone else learns nothing more than "not for you".
  if (row.userId !== userId) return 'wrong_user'
  if (row.status !== 'PENDING') return 'used'
  if (row.tokenExpiresAt.getTime() <= now.getTime()) return 'expired'
  return 'ok'
}

export async function previewLinkToken(db: LinkDb, input: { userId: string; token: string; now?: Date }): Promise<LinkTokenState> {
  const row = await db.employerAccountLink.findUnique({ where: { tokenHash: hashLinkToken(input.token) }, select: { userId: true, status: true, tokenExpiresAt: true } })
  return evaluateLinkRow(row, input.userId, input.now ?? new Date())
}

export type ConfirmResult = { ok: true; linkId: string; otherUserId: string } | { ok: false; reason: Exclude<LinkTokenState, 'ok'> | 'not_verified' }

/**
 * Records the link. Single use: the PENDING row is flipped to ACTIVE in one conditional update, so two clicks (or a mail
 * scanner and a person) cannot both win. `partyVerified` is asked about the other account: it must still exist with a
 * confirmed email.
 */
export async function confirmAccountLink(
  db: LinkDb,
  input: { userId: string; token: string; now?: Date },
  deps: { partyVerified: (userId: string) => Promise<boolean> },
): Promise<ConfirmResult> {
  const now = input.now ?? new Date()
  const row = await db.employerAccountLink.findUnique({
    where: { tokenHash: hashLinkToken(input.token) },
    select: { id: true, userId: true, otherUserId: true, status: true, tokenExpiresAt: true },
  })
  const state = evaluateLinkRow(row, input.userId, now)
  if (state !== 'ok' || !row) return { ok: false, reason: state === 'ok' ? 'invalid' : state }
  if (!(await deps.partyVerified(row.otherUserId))) return { ok: false, reason: 'not_verified' }
  const done = await db.employerAccountLink.updateMany({
    where: { id: row.id, userId: input.userId, status: 'PENDING', tokenExpiresAt: { gt: now } },
    data: { status: 'ACTIVE', verifiedAt: now },
  })
  if (done.count !== 1) return { ok: false, reason: 'used' }
  return { ok: true, linkId: row.id, otherUserId: row.otherUserId }
}

export type RequestResult =
  | { ok: true; linkId: string }
  | { ok: false; reason: 'invalid_email' | 'same_account' | 'no_account' | 'not_verified' | 'already_linked' | 'rate_limited' | 'send_failed' }

export interface RequestDeps {
  /** The auth user id that owns this address, or null when there is no account. */
  findUserIdByEmail: (email: string) => Promise<string | null>
  partyVerified: (userId: string) => Promise<boolean>
  /** Rate limit: true when the request may go ahead. */
  allow: (bucket: string, key: string, limit: number, windowMs: number) => Promise<boolean>
  /** Emails the single-use token to the other address. */
  sendEmail: (input: { to: string; token: string; requesterEmail: string | null }) => Promise<boolean>
  now?: Date
}

const HOUR = 60 * 60 * 1000

export async function requestAccountLink(
  db: LinkDb,
  input: { userId: string; ownEmail: string | null; otherEmail: unknown },
  deps: RequestDeps,
): Promise<RequestResult> {
  const other = normalizeLinkEmail(input.otherEmail)
  if (!other) return { ok: false, reason: 'invalid_email' }
  if (input.ownEmail && input.ownEmail.trim().toLowerCase() === other) return { ok: false, reason: 'same_account' }
  // Per person, before any lookup, so the "no account" answer cannot be used to probe addresses quickly. And per target
  // address, so one inbox cannot be mail-bombed.
  if (!(await deps.allow('employer-link-request', input.userId, 5, HOUR))) return { ok: false, reason: 'rate_limited' }
  if (!(await deps.allow('employer-link-target', other, 3, HOUR))) return { ok: false, reason: 'rate_limited' }

  const otherUserId = await deps.findUserIdByEmail(other)
  if (!otherUserId) return { ok: false, reason: 'no_account' }
  if (otherUserId === input.userId) return { ok: false, reason: 'same_account' }
  if (!(await deps.partyVerified(otherUserId))) return { ok: false, reason: 'not_verified' }

  const existing = await db.employerAccountLink.findFirst({
    where: { status: 'ACTIVE', OR: [{ userId: input.userId, otherUserId }, { userId: otherUserId, otherUserId: input.userId }] },
    select: { id: true },
  })
  if (existing) return { ok: false, reason: 'already_linked' }

  const now = deps.now ?? new Date()
  // A new request replaces this person's earlier unused one for the same account, so only the newest token works.
  await db.employerAccountLink.updateMany({
    where: { userId: input.userId, otherUserId, status: 'PENDING' },
    data: { status: 'REMOVED', removedAt: now, removedBy: input.userId },
  })
  const { token, tokenHash } = newLinkToken()
  const row = await db.employerAccountLink.create({
    data: { userId: input.userId, otherUserId, tokenHash, tokenExpiresAt: new Date(now.getTime() + LINK_TOKEN_TTL_MS) },
    select: { id: true },
  })
  const sent = await deps.sendEmail({ to: other, token, requesterEmail: input.ownEmail })
  if (!sent) {
    await db.employerAccountLink.updateMany({ where: { id: row.id }, data: { status: 'REMOVED', removedAt: now, removedBy: input.userId } })
    return { ok: false, reason: 'send_failed' }
  }
  return { ok: true, linkId: row.id }
}

/** Either side can remove an active link, and the asker can cancel a pending one. Returns what was removed, or null. */
export async function removeAccountLink(db: LinkDb, input: { userId: string; linkId: string; now?: Date }): Promise<{ wasActive: boolean } | null> {
  const now = input.now ?? new Date()
  const row = await db.employerAccountLink.findFirst({
    where: { id: input.linkId, status: { in: ['ACTIVE', 'PENDING'] }, OR: [{ userId: input.userId }, { otherUserId: input.userId, status: 'ACTIVE' }] },
    select: { id: true, status: true },
  })
  if (!row) return null
  const was = row.status
  const done = await db.employerAccountLink.updateMany({
    where: { id: row.id, status: was },
    data: { status: 'REMOVED', removedAt: now, removedBy: input.userId },
  })
  return done.count === 1 ? { wasActive: was === 'ACTIVE' } : null
}

export interface LinkSummary {
  id: string
  /** The other account's user id. */
  otherUserId: string
  status: 'ACTIVE' | 'PENDING'
  tokenExpiresAt: Date
  /** True when this person asked for it (only they can see and cancel a pending one). */
  asker: boolean
}

/** Active links (either side) and this person's own unexpired pending requests. */
export async function listAccountLinks(db: LinkDb, userId: string, now: Date = new Date()): Promise<LinkSummary[]> {
  const rows = await db.employerAccountLink.findMany({
    where: {
      OR: [
        { status: 'ACTIVE', userId },
        { status: 'ACTIVE', otherUserId: userId },
        { status: 'PENDING', userId, tokenExpiresAt: { gt: now } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, userId: true, otherUserId: true, status: true, tokenExpiresAt: true },
  })
  return rows.map((r) => ({
    id: r.id,
    otherUserId: r.userId === userId ? r.otherUserId : r.userId,
    status: r.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
    tokenExpiresAt: r.tokenExpiresAt,
    asker: r.userId === userId,
  }))
}

/**
 * The linked account the bridge may sign in as: only while an ACTIVE link joins the two people AND the linked account is a
 * verified party (it still exists and its email is confirmed). Returns that account's verified email, or null.
 */
export async function linkedBridgeIdentity(
  db: LinkDb,
  input: { userId: string; linkedUserId: string },
  deps: { verifiedEmail: (userId: string) => Promise<string | null> },
): Promise<{ id: string; email: string } | null> {
  if (!input.linkedUserId || input.linkedUserId === input.userId) return null
  const link = await db.employerAccountLink.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        { userId: input.userId, otherUserId: input.linkedUserId },
        { userId: input.linkedUserId, otherUserId: input.userId },
      ],
    },
    select: { id: true },
  })
  if (!link) return null
  const email = await deps.verifiedEmail(input.linkedUserId)
  return email ? { id: input.linkedUserId, email } : null
}
