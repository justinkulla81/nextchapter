import 'server-only'
import { promises as dns } from 'node:dns'
import { prisma } from '@/lib/prisma'
import { domainOf } from '@/lib/mailing/layoff-pacing-rules'
import type { AddressFacts } from './quality'

const MX_TTL_MS = 6 * 3_600_000
const MX_TIMEOUT_MS = 2_500
const mxCache = new Map<string, { at: number; ok: boolean | null }>()

/** Whether a domain has a mail server (an MX record, or an address record as the fallback). Null when the lookup is inconclusive (a timeout or a resolver error): that is not held against the address. */
async function hasMailServer(domain: string): Promise<boolean | null> {
  const hit = mxCache.get(domain)
  if (hit && Date.now() - hit.at < MX_TTL_MS) return hit.ok
  const withTimeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), MX_TIMEOUT_MS))])
  let ok: boolean | null
  try {
    const mx = await withTimeout(dns.resolveMx(domain))
    ok = mx.length > 0 ? true : !!(await withTimeout(dns.resolve4(domain).catch(() => [] as string[]))).length
  } catch (e) {
    const code = (e as { code?: string }).code
    ok = code === 'ENOTFOUND' || code === 'ENODATA' ? ((await withTimeout(dns.resolve4(domain)).catch(() => [] as string[])).length > 0) : null
  }
  mxCache.set(domain, { at: Date.now(), ok })
  return ok
}

/**
 * What the quality rules (quality.ts) need to know about each address: the CRM contact and what Hunter said, whether they have replied, what
 * our own sends to the same domain have done, and whether the domain has a mail server. Reads: the contacts (by id), two small group-bys over
 * the mailing recipient and suppression tables for the addresses' domains (about 10,000 and a few thousand rows), and one DNS lookup per new domain.
 */
export async function loadAddressFacts(items: { email: string; personId?: string | null }[]): Promise<Map<string, AddressFacts>> {
  const byEmail = new Map<string, string | null>()
  for (const it of items) {
    const e = it.email?.trim().toLowerCase()
    if (!e) continue
    if (!byEmail.has(e) || (!byEmail.get(e) && it.personId)) byEmail.set(e, it.personId ?? null)
  }
  const emails = [...byEmail.keys()]
  const out = new Map<string, AddressFacts>()
  if (emails.length === 0) return out
  const personIds = [...new Set([...byEmail.values()].filter((x): x is string => !!x))]
  const domains = [...new Set(emails.map(domainOf).filter(Boolean))]

  const [people, delivered, bounced] = await Promise.all([
    personIds.length
      ? prisma.crmPerson.findMany({
          where: { id: { in: personIds }, deletedAt: null },
          select: { id: true, email: true, emails: true, emailVerifiedStatus: true, emailVerifyScore: true, emailVerifiedAt: true, warmth: true, firstRepliedAt: true },
        })
      : Promise.resolve([]),
    prisma.$queryRaw<{ dom: string; n: bigint; b: bigint }[]>`
      SELECT split_part(lower(email), '@', 2) AS dom,
             count(*) FILTER (WHERE "deliveredAt" IS NOT NULL) AS n, count(*) FILTER (WHERE "bouncedAt" IS NOT NULL) AS b
      FROM "MailingEditionRecipient" WHERE split_part(lower(email), '@', 2) = ANY(${domains}::text[]) GROUP BY 1`,
    prisma.$queryRaw<{ dom: string; n: bigint }[]>`
      SELECT split_part(lower(email), '@', 2) AS dom, count(*) AS n
      FROM "MailingSuppression" WHERE reason = 'BOUNCED' AND split_part(lower(email), '@', 2) = ANY(${domains}::text[]) GROUP BY 1`,
  ])
  const person = new Map(people.map((p) => [p.id, p]))
  const dom = new Map<string, { d: number; b: number }>()
  for (const r of delivered) dom.set(r.dom, { d: Number(r.n), b: Number(r.b) })
  for (const r of bounced) { const x = dom.get(r.dom) ?? { d: 0, b: 0 }; x.b = Math.max(x.b, Number(r.n)); dom.set(r.dom, x) }
  const mx = new Map<string, boolean | null>()
  await Promise.all(domains.map(async (d) => { mx.set(d, await hasMailServer(d)) }))

  for (const email of emails) {
    const p = byEmail.get(email) ? person.get(byEmail.get(email)!) : undefined
    const d = dom.get(domainOf(email))
    out.set(email, {
      email,
      personId: p ? p.id : null,
      hunterStatus: p?.emailVerifiedStatus ?? null,
      hunterScore: p?.emailVerifyScore ?? null,
      hunterAt: p?.emailVerifiedAt ?? null,
      primaryMatches: !!p && (p.email ?? '').trim().toLowerCase() === email,
      warmth: p?.warmth ?? null,
      replied: !!p?.firstRepliedAt,
      domainDelivered: d?.d ?? 0,
      domainBounced: d?.b ?? 0,
      mx: mx.get(domainOf(email)) ?? null,
    })
  }
  return out
}
