/**
 * Addresses for named people at agencies where Hunter's Email Finder found nothing, by the agency's own address pattern.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/hunter-patterns.ts <names.txt> <out.json> [--apply]
 *
 * <names.txt> has one full name per line. For each person with no email and no guess: the candidate domains (the host of the page
 * that named them, and its parent), then Hunter's Domain Search for the pattern that domain's real addresses follow ("{first}.{last}"),
 * then the address that pattern gives, checked with the Email Verifier. A `valid` address becomes the email. An address on a domain
 * that accepts everything (`accept_all`) cannot be confirmed, so with a pattern Hunter read off real addresses it is kept only as a
 * guess, never as the email. Without a pattern, three common ones are tried. Costs: one search per distinct domain (cached) and one
 * verification per candidate address.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'

const KEY = process.env.HUNTER_API_KEY
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase() } catch { return null } }

async function hunter(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, api_key: KEY! })
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.hunter.io/v2/${path}?${qs}`, { signal: AbortSignal.timeout(60_000) }).catch(() => null)
    if (!res) { await sleep(3000); continue }
    if (res.status === 429 || res.status === 202) { await sleep(6000 * (attempt + 1)); continue }
    if (res.status === 401 || res.status === 403) throw new Error(`Hunter refused the request (${res.status})`)
    return res.json().catch(() => null)
  }
  return null
}

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z-]/g, '')
function nameParts(full: string): { first: string; last: string } {
  const toks = full.replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim().split(/\s+/).filter((t) => !/^(dr|mr|mrs|ms|hon|rev|prof)\.?$/i.test(t))
  const real = toks.filter((t) => !/^[A-Za-z]\.$/.test(t))
  return { first: ascii(real[0] ?? ''), last: ascii(real[real.length - 1] ?? '') }
}
const fromPattern = (pattern: string, first: string, last: string) => pattern
  .replace('{first}', first).replace('{last}', last).replace('{f}', first[0] ?? '').replace('{l}', last[0] ?? '')
  .replace('{first}{last}', first + last)
const COMMON = ['{first}.{last}', '{f}{last}', '{first}_{last}']

async function main() {
  const [namesFile, out, flag] = process.argv.slice(2)
  if (!KEY) throw new Error('HUNTER_API_KEY is not set')
  const apply = flag === '--apply'
  const names = readFileSync(namesFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, mergedIntoId: null, email: null, guessedEmail: null, fullName: { in: names } },
    select: { id: true, fullName: true, notes: true, affiliations: { where: { isCurrent: true }, select: { org: { select: { name: true, emailDomain: true } } }, take: 1 } },
  })
  console.log(`${people.length} people to check`)
  const domainCache = new Map<string, { pattern: string | null; acceptAll: boolean; found: boolean }>()
  const tally = { searches: 0, verifications: 0, valid: 0, guess: 0, none: 0 }
  const rows: any[] = []

  const probe = async (domain: string) => {
    if (domainCache.has(domain)) return domainCache.get(domain)!
    tally.searches++
    const j = await hunter('domain-search', { domain, limit: '1' })
    const d = j?.data
    const res = { pattern: (d?.pattern as string | null) ?? null, acceptAll: !!d?.accept_all, found: !!(d?.organization || (d?.emails?.length ?? 0) > 0 || d?.pattern) }
    domainCache.set(domain, res)
    return res
  }
  const verify = async (email: string) => {
    tally.verifications++
    const j = await hunter('email-verifier', { email })
    return (j?.data?.status as string | undefined) ?? null
  }

  for (const p of people) {
    const { first, last } = nameParts(p.fullName)
    const src = /Found by web search: (\S+)/.exec(p.notes ?? '')?.[1]?.replace(/[).,]+$/, '')
    const host = src ? hostOf(src) : null
    const domains = [...new Set([p.affiliations[0]?.org.emailDomain, host, host && host.split('.').length > 3 ? host.split('.').slice(1).join('.') : null, host && host.split('.').length > 2 ? host.split('.').slice(-3).join('.') : null].filter(Boolean) as string[])]
    const row: any = { id: p.id, name: p.fullName, org: p.affiliations[0]?.org.name, domainsTried: [] as string[], email: null, status: null, how: null }
    if (!first || !last || !domains.length) { rows.push({ ...row, how: 'no name or domain' }); tally.none++; continue }
    let best: { email: string; status: string | null; how: string; acceptAll: boolean } | null = null
    for (const domain of domains) {
      row.domainsTried.push(domain)
      const info = await probe(domain)
      if (!info.found) continue
      const candidates = info.pattern ? [fromPattern(info.pattern, first, last)] : COMMON.map((c) => fromPattern(c, first, last))
      for (const local of candidates) {
        const email = `${local}@${domain}`
        const status = await verify(email)
        if (status === 'valid') { best = { email, status, how: info.pattern ? `pattern ${info.pattern}` : 'common pattern', acceptAll: false }; break }
        if (info.pattern && (status === 'accept_all' || status === 'unknown')) best = best ?? { email, status, how: `pattern ${info.pattern} (domain accepts all addresses)`, acceptAll: true }
        await sleep(200)
      }
      if (best?.status === 'valid') break
    }
    if (!best) { rows.push({ ...row, how: 'no match' }); tally.none++; continue }
    rows.push({ ...row, email: best.email, status: best.status, how: best.how })
    if (best.status === 'valid') tally.valid++; else tally.guess++
    if (apply) {
      const taken = await prisma.crmPerson.findFirst({ where: { id: { not: p.id }, OR: [{ email: best.email }, { emails: { has: best.email } }] }, select: { id: true } })
      if (taken) { rows[rows.length - 1].how += ' (address already belongs to someone else)'; continue }
      await prisma.crmPerson.update({
        where: { id: p.id },
        data: best.status === 'valid'
          ? { email: best.email, emailVerifiedStatus: 'valid', emailVerifiedAt: new Date(), emailSource: `Hunter verifier, ${best.how}` }
          : { guessedEmail: best.email, guessedEmailBasis: `Hunter ${best.how}, status ${best.status}` },
      })
    }
  }
  writeFileSync(out, JSON.stringify(rows, null, 1))
  console.log(tally, `Saved ${out}`)
  for (const r of rows) console.log(`${r.name} | ${r.org} | ${r.email ?? '-'} | ${r.status ?? ''} | ${r.how}`)
  const rq = (await hunter('account', {}))?.data?.requests
  if (rq) console.log(`Hunter left: ${rq.searches?.remaining} searches, ${rq.verifications?.remaining} verifications`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
