import { describe, expect, it, vi } from 'vitest'
import { getEmployerAccess, type EmployerAccessDb } from '@/lib/employer/access'
import {
  LINK_TOKEN_TTL_MS,
  confirmAccountLink,
  hashLinkToken,
  linkedBridgeIdentity,
  listAccountLinks,
  removeAccountLink,
  requestAccountLink,
  type LinkDb,
  type RequestDeps,
} from '@/lib/employer/account-link'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

interface Row {
  id: string
  userId: string
  otherUserId: string
  tokenHash: string
  tokenExpiresAt: Date
  status: string
  verifiedAt?: Date
  removedBy?: string
}

// A tiny in-memory stand-in for the EmployerAccountLink delegate: just the where shapes the library uses.
function memoryDb(rows: Row[] = []) {
  let n = 0
  const match = (r: Row, w: any): boolean => {
    if (w.OR && !w.OR.some((o: any) => match(r, o))) return false
    for (const k of ['id', 'userId', 'otherUserId', 'tokenHash'] as const) if (w[k] !== undefined && r[k] !== w[k]) return false
    if (w.status !== undefined) {
      if (typeof w.status === 'string' ? r.status !== w.status : !w.status.in.includes(r.status)) return false
    }
    if (w.tokenExpiresAt?.gt && !(r.tokenExpiresAt > w.tokenExpiresAt.gt)) return false
    return true
  }
  const delegate = {
    findUnique: async ({ where }: any) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
    findFirst: async ({ where }: any) => rows.find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: any) => rows.filter((r) => match(r, where)),
    create: async ({ data }: any) => {
      const r = { id: `l${++n}`, status: 'PENDING', ...data } as Row
      rows.push(r)
      return r
    },
    updateMany: async ({ where, data }: any) => {
      const hit = rows.filter((r) => match(r, where))
      hit.forEach((r) => Object.assign(r, data.removedBy ? { ...data, removedBy: data.removedBy } : data))
      return { count: hit.length }
    },
  }
  return { rows, db: { employerAccountLink: delegate } as unknown as LinkDb & EmployerAccessDb }
}

const NOW = new Date('2026-10-26T12:00:00Z')
const row = (over: Partial<Row> = {}): Row => ({ id: 'l1', userId: 'A', otherUserId: 'B', tokenHash: hashLinkToken('tok'), tokenExpiresAt: new Date(NOW.getTime() + 10 * 60_000), status: 'PENDING', ...over })
const verified = { partyVerified: async () => true }

describe('token expiry, single use and wrong user', () => {
  it('confirms a good token for the account that asked, and activates the link', async () => {
    const { db, rows } = memoryDb([row()])
    const r = await confirmAccountLink(db, { userId: 'A', token: 'tok', now: NOW }, verified)
    expect(r).toEqual({ ok: true, linkId: 'l1', otherUserId: 'B' })
    expect(rows[0].status).toBe('ACTIVE')
  })

  it('refuses an expired token and leaves it pending', async () => {
    const { db, rows } = memoryDb([row({ tokenExpiresAt: new Date(NOW.getTime() - 1) })])
    expect(await confirmAccountLink(db, { userId: 'A', token: 'tok', now: NOW }, verified)).toEqual({ ok: false, reason: 'expired' })
    expect(rows[0].status).toBe('PENDING')
  })

  it('works once: a second use of the same token is refused', async () => {
    const { db } = memoryDb([row()])
    expect((await confirmAccountLink(db, { userId: 'A', token: 'tok', now: NOW }, verified)).ok).toBe(true)
    expect(await confirmAccountLink(db, { userId: 'A', token: 'tok', now: NOW }, verified)).toEqual({ ok: false, reason: 'used' })
  })

  it('refuses anyone but the account that asked, including the owner of the other address', async () => {
    const { db, rows } = memoryDb([row()])
    expect(await confirmAccountLink(db, { userId: 'B', token: 'tok', now: NOW }, verified)).toEqual({ ok: false, reason: 'wrong_user' })
    expect(await confirmAccountLink(db, { userId: 'C', token: 'tok', now: NOW }, verified)).toEqual({ ok: false, reason: 'wrong_user' })
    expect(rows[0].status).toBe('PENDING')
  })

  it('refuses an unknown token', async () => {
    const { db } = memoryDb([row()])
    expect(await confirmAccountLink(db, { userId: 'A', token: 'nope', now: NOW }, verified)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('refuses when the other account is no longer a verified party', async () => {
    const { db, rows } = memoryDb([row()])
    expect(await confirmAccountLink(db, { userId: 'A', token: 'tok', now: NOW }, { partyVerified: async () => false })).toEqual({ ok: false, reason: 'not_verified' })
    expect(rows[0].status).toBe('PENDING')
  })
})

function deps(over: Partial<RequestDeps> = {}): RequestDeps & { sent: Array<{ to: string; token: string }> } {
  const sent: Array<{ to: string; token: string }> = []
  return {
    sent,
    findUserIdByEmail: async (e) => (e === 'b@outplace.com' ? 'B' : null),
    partyVerified: async () => true,
    allow: async () => true,
    sendEmail: async ({ to, token }) => {
      sent.push({ to, token })
      return true
    },
    now: NOW,
    ...over,
  }
}

describe('requesting a link', () => {
  it('emails a short-lived single-use token to the other address and stores only its hash', async () => {
    const { db, rows } = memoryDb()
    const d = deps()
    const r = await requestAccountLink(db, { userId: 'A', ownEmail: 'a@acme.com', otherEmail: ' B@Outplace.com ' }, d)
    expect(r.ok).toBe(true)
    expect(d.sent).toHaveLength(1)
    expect(d.sent[0].to).toBe('b@outplace.com')
    expect(rows[0].tokenHash).toBe(hashLinkToken(d.sent[0].token))
    expect(rows[0].tokenHash).not.toBe(d.sent[0].token)
    expect(rows[0].tokenExpiresAt.getTime() - NOW.getTime()).toBe(LINK_TOKEN_TTL_MS)
    expect(LINK_TOKEN_TTL_MS).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000)
    expect(rows[0].status).toBe('PENDING')
    expect(JSON.stringify(rows[0])).not.toContain('outplace.com')
  })

  it('refuses an address with no account, and sends nothing', async () => {
    const { db, rows } = memoryDb()
    const d = deps()
    expect(await requestAccountLink(db, { userId: 'A', ownEmail: 'a@acme.com', otherEmail: 'nobody@x.com' }, d)).toEqual({ ok: false, reason: 'no_account' })
    expect(d.sent).toHaveLength(0)
    expect(rows).toHaveLength(0)
  })

  it('refuses a bad address, your own address, and an unverified account', async () => {
    const { db } = memoryDb()
    expect((await requestAccountLink(db, { userId: 'A', ownEmail: 'a@acme.com', otherEmail: 'nope' }, deps())).ok).toBe(false)
    expect(await requestAccountLink(db, { userId: 'A', ownEmail: 'a@acme.com', otherEmail: 'A@acme.com' }, deps())).toEqual({ ok: false, reason: 'same_account' })
    expect(await requestAccountLink(db, { userId: 'A', ownEmail: 'a@acme.com', otherEmail: 'b@outplace.com' }, deps({ partyVerified: async () => false }))).toEqual({ ok: false, reason: 'not_verified' })
    // Another address of the same account.
    expect(await requestAccountLink(db, { userId: 'B', ownEmail: 'x@y.com', otherEmail: 'b@outplace.com' }, deps())).toEqual({ ok: false, reason: 'same_account' })
  })

  it('is rate limited per person and per target address', async () => {
    const { db } = memoryDb()
    const d = deps({ allow: async (bucket) => bucket !== 'employer-link-target' })
    expect(await requestAccountLink(db, { userId: 'A', ownEmail: 'a@acme.com', otherEmail: 'b@outplace.com' }, d)).toEqual({ ok: false, reason: 'rate_limited' })
    expect(d.sent).toHaveLength(0)
  })

  it('a newer request replaces an older unused one, so only the newest token works', async () => {
    const { db, rows } = memoryDb()
    const d = deps()
    await requestAccountLink(db, { userId: 'A', ownEmail: 'a@acme.com', otherEmail: 'b@outplace.com' }, d)
    await requestAccountLink(db, { userId: 'A', ownEmail: 'a@acme.com', otherEmail: 'b@outplace.com' }, d)
    expect(rows.map((r) => r.status)).toEqual(['REMOVED', 'PENDING'])
    expect((await confirmAccountLink(db, { userId: 'A', token: d.sent[0].token, now: NOW }, verified)).ok).toBe(false)
    expect((await confirmAccountLink(db, { userId: 'A', token: d.sent[1].token, now: NOW }, verified)).ok).toBe(true)
  })

  it('removes the request when the email cannot be sent', async () => {
    const { db, rows } = memoryDb()
    expect(await requestAccountLink(db, { userId: 'A', ownEmail: 'a@acme.com', otherEmail: 'b@outplace.com' }, deps({ sendEmail: async () => false }))).toEqual({ ok: false, reason: 'send_failed' })
    expect(rows[0].status).toBe('REMOVED')
  })

  it('refuses a second link between accounts that are already linked', async () => {
    const { db } = memoryDb([row({ status: 'ACTIVE' })])
    expect(await requestAccountLink(db, { userId: 'B', ownEmail: 'b@outplace.com', otherEmail: 'a@acme.com' }, deps({ findUserIdByEmail: async () => 'A' }))).toEqual({ ok: false, reason: 'already_linked' })
  })
})

describe('unlinking', () => {
  it('either side can unlink an active link', async () => {
    for (const who of ['A', 'B']) {
      const { db, rows } = memoryDb([row({ status: 'ACTIVE' })])
      expect(await removeAccountLink(db, { userId: who, linkId: 'l1', now: NOW })).toEqual({ wasActive: true })
      expect(rows[0]).toMatchObject({ status: 'REMOVED', removedBy: who })
    }
  })

  it('a stranger cannot unlink, and the other side cannot cancel a pending request', async () => {
    const { db, rows } = memoryDb([row({ status: 'ACTIVE' }), row({ id: 'l2', status: 'PENDING', tokenHash: 'h2' })])
    expect(await removeAccountLink(db, { userId: 'C', linkId: 'l1' })).toBeNull()
    expect(await removeAccountLink(db, { userId: 'B', linkId: 'l2' })).toBeNull()
    expect(await removeAccountLink(db, { userId: 'A', linkId: 'l2' })).toEqual({ wasActive: false })
    expect(rows[0].status).toBe('ACTIVE')
  })

  it('after unlinking, access no longer includes the other account and the bridge refuses it', async () => {
    const { db } = memoryDb([row({ status: 'ACTIVE' })])
    await removeAccountLink(db, { userId: 'B', linkId: 'l1' })
    const identity = await linkedBridgeIdentity(db, { userId: 'A', linkedUserId: 'B' }, { verifiedEmail: async () => 'b@outplace.com' })
    expect(identity).toBeNull()
  })

  it('lists active links for both sides and pending requests only for the asker', async () => {
    const { db } = memoryDb([row({ status: 'ACTIVE' }), row({ id: 'l2', userId: 'A', otherUserId: 'C', status: 'PENDING', tokenHash: 'h2' })])
    expect((await listAccountLinks(db, 'A', NOW)).map((l) => [l.otherUserId, l.status, l.asker])).toEqual([['B', 'ACTIVE', true], ['C', 'PENDING', true]])
    expect((await listAccountLinks(db, 'B', NOW)).map((l) => [l.otherUserId, l.status, l.asker])).toEqual([['A', 'ACTIVE', false]])
    expect(await listAccountLinks(db, 'C', NOW)).toEqual([])
  })
})

describe('the bridge identity', () => {
  it('is the linked account only while an active link joins the two and that account is verified', async () => {
    const { db } = memoryDb([row({ status: 'ACTIVE' })])
    const verifiedEmail = async () => 'b@outplace.com'
    expect(await linkedBridgeIdentity(db, { userId: 'A', linkedUserId: 'B' }, { verifiedEmail })).toEqual({ id: 'B', email: 'b@outplace.com' })
    expect(await linkedBridgeIdentity(db, { userId: 'B', linkedUserId: 'A' }, { verifiedEmail: async () => 'a@acme.com' })).toEqual({ id: 'A', email: 'a@acme.com' })
    expect(await linkedBridgeIdentity(db, { userId: 'A', linkedUserId: 'B' }, { verifiedEmail: async () => null })).toBeNull()
    expect(await linkedBridgeIdentity(db, { userId: 'C', linkedUserId: 'B' }, { verifiedEmail })).toBeNull()
    expect(await linkedBridgeIdentity(db, { userId: 'A', linkedUserId: 'A' }, { verifiedEmail })).toBeNull()
  })

  it('is never available from a pending link', async () => {
    const { db } = memoryDb([row()])
    expect(await linkedBridgeIdentity(db, { userId: 'A', linkedUserId: 'B' }, { verifiedEmail: async () => 'b@outplace.com' })).toBeNull()
  })
})

// getEmployerAccess with linked accounts.
function accessDb(links: Row[], held: Record<string, { profile?: { id: string }; orgUser?: { role: string; orgId: string } }>, opts: { linkTableMissing?: boolean } = {}): EmployerAccessDb {
  const m = memoryDb(links)
  return {
    employerProfile: { findUnique: async ({ where }: any) => held[where.userId]?.profile ?? null },
    employerSeat: { findFirst: async () => null },
    outplacementOrgUser: { findUnique: async ({ where }: any) => held[where.userId]?.orgUser ?? null },
    outplacementContract: { findMany: async () => [] },
    orgWorkspaceAdmin: { findMany: async () => [] },
    employerAccountLink: opts.linkTableMissing
      ? {
          findMany: async () => {
            throw new Error('relation "EmployerAccountLink" does not exist')
          },
        }
      : m.db.employerAccountLink,
  } as unknown as EmployerAccessDb
}

describe('getEmployerAccess with linked accounts', () => {
  const held = { A: { profile: { id: 'p1' } }, B: { orgUser: { role: 'ADMIN', orgId: 'o1' } } }

  it('is unchanged unless includeLinked is asked for', async () => {
    const db = accessDb([row({ status: 'ACTIVE' })], held)
    const a = await getEmployerAccess({ userId: 'A' }, db)
    expect(a.sections).toEqual(['hiring'])
  })

  it('adds the linked account\'s sections, tagged with whose they are, for either side', async () => {
    const db = accessDb([row({ status: 'ACTIVE' })], held)
    const a = await getEmployerAccess({ userId: 'A', includeLinked: true }, db)
    expect(a.sections).toEqual(['hiring', 'outplacement'])
    expect(a.grants.find((g) => g.section === 'outplacement')).toMatchObject({ viaUserId: 'B', viaLinkId: 'l1', role: 'ADMIN' })
    expect(a.grants.find((g) => g.section === 'hiring')?.viaUserId).toBeUndefined()
    const b = await getEmployerAccess({ userId: 'B', includeLinked: true }, db)
    expect(b.sections).toEqual(['hiring', 'outplacement'])
    expect(b.grants.find((g) => g.section === 'hiring')).toMatchObject({ viaUserId: 'A' })
  })

  it('is always a superset of the unlinked access, with the same own grants first', async () => {
    const db = accessDb([row({ status: 'ACTIVE' })], held)
    const plain = await getEmployerAccess({ userId: 'A' }, db)
    const linked = await getEmployerAccess({ userId: 'A', includeLinked: true }, db)
    expect(linked.grants.slice(0, plain.grants.length)).toEqual(plain.grants)
    for (const s of plain.sections) expect(linked.sections).toContain(s)
  })

  it('ignores pending and removed links and links of other people', async () => {
    const db = accessDb([row({ status: 'PENDING' }), row({ id: 'l2', status: 'REMOVED', tokenHash: 'h2' }), row({ id: 'l3', userId: 'X', otherUserId: 'B', status: 'ACTIVE', tokenHash: 'h3' })], held)
    const a = await getEmployerAccess({ userId: 'A', includeLinked: true }, db)
    expect(a.sections).toEqual(['hiring'])
  })

  it('does not change roles: the linked grant keeps the role it has on its own account', async () => {
    const db = accessDb([row({ status: 'ACTIVE' })], { A: { profile: { id: 'p1' } }, B: { orgUser: { role: 'VIEWER', orgId: 'o1' } } })
    const a = await getEmployerAccess({ userId: 'A', includeLinked: true }, db)
    expect(a.grants.find((g) => g.section === 'outplacement')?.role).toBe('VIEWER')
  })

  it('fails soft when the table is missing: today\'s access is the answer, with a warning', async () => {
    const db = accessDb([], held, { linkTableMissing: true })
    const a = await getEmployerAccess({ userId: 'A', includeLinked: true }, db)
    expect(a.sections).toEqual(['hiring'])
    expect(a.warnings?.[0]).toContain('EmployerAccountLink not readable')
  })

  it('fails soft when the database has no such delegate at all', async () => {
    const db = { ...accessDb([], held), employerAccountLink: undefined } as unknown as EmployerAccessDb
    const a = await getEmployerAccess({ userId: 'A', includeLinked: true }, db)
    expect(a.sections).toEqual(['hiring'])
    expect(a.warnings).toBeTruthy()
  })
})

describe('the link never touches logins', () => {
  it('the link library and its wiring do not touch cookies, middleware or any Google write', async () => {
    const { readFileSync } = await import('node:fs')
    const files = ['src/lib/employer/account-link.ts', 'src/lib/employer/account-link-server.ts', 'src/app/api/employer/account-link/route.ts', 'src/lib/email/send-account-link.ts']
    for (const f of files) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      expect(src).not.toMatch(/cookies\(\)\.set|\.cookies\.set|PORTAL_COOKIE_NAMES|setAll|updateSession|googleapis|gmail\.|calendar\./i)
    }
  })
})
