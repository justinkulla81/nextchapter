/**
 * Email addresses for people the web-search finders found by name and title but with no address, using Hunter's Email Finder.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/hunter-people.ts <maxSearches> <out.json> [--apply]
 *
 * Who: CRM people with no email and no guess whose note says "Found by web search". The domain is the organization's saved email
 * domain; failing that, for a government organization, the host of the page that named them. One Email Finder call each (charged
 * only when an address is found). With --apply, a `valid` address becomes their email, a confident one (score 85+) a guess, and
 * nothing is written for an address another person already holds.
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'

const KEY = process.env.HUNTER_API_KEY
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase() } catch { return null } }
const NEWSY = /(news|times|post|journal|business|wire|press|reuters|bloomberg|forbes|linkedin|wikipedia|prnewswire|globenewswire|yahoo|google|facebook|crunchbase|zoominfo|rocketreach|theorg)/i

async function hunter(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, api_key: KEY! })
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.hunter.io/v2/${path}?${qs}`, { signal: AbortSignal.timeout(30_000) }).catch(() => null)
    if (!res) { await sleep(3000); continue }
    if (res.status === 429 || res.status === 202) { await sleep(6000 * (attempt + 1)); continue }
    if (res.status === 401 || res.status === 403) throw new Error(`Hunter refused the request (${res.status})`)
    return res.json().catch(() => null)
  }
  return null
}

async function main() {
  const [maxArg, out, flag] = process.argv.slice(2)
  if (!KEY) throw new Error('HUNTER_API_KEY is not set')
  const max = Number(maxArg ?? 100), apply = flag === '--apply'
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, mergedIntoId: null, email: null, guessedEmail: null, notes: { contains: 'Found by web search' } },
    select: { id: true, fullName: true, firstName: true, lastName: true, notes: true, affiliations: { where: { isCurrent: true }, select: { title: true, org: { select: { name: true, emailDomain: true, orgTypes: true } } }, take: 1 } },
  })
  const targets = people.flatMap((p) => {
    const a = p.affiliations[0]; if (!a) return []
    const parts = p.fullName.trim().split(/\s+/)
    const first = (p.firstName ?? parts[0] ?? '').trim(), last = (p.lastName ?? parts[parts.length - 1] ?? '').trim()
    const src = /Found by web search: (\S+)/.exec(p.notes ?? '')?.[1]?.replace(/[).,]+$/, '')
    const srcHost = src ? hostOf(src) : null
    const domain = a.org.emailDomain ?? (a.org.orgTypes.includes('GOVERNMENT') && srcHost && !NEWSY.test(srcHost) ? srcHost : null)
    return first && last && domain ? [{ id: p.id, name: p.fullName, org: a.org.name, title: a.title, first, last, domain }] : []
  })
  console.log(`${people.length} people without an address; ${targets.length} with a domain; up to ${max} searches`)

  const queue = targets.slice(0, max)
  const rows: any[] = []
  const tally = { searched: 0, found: 0, valid: 0, guessed: 0, written: 0, takenByOther: 0 }
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      tally.searched++
      const j = await hunter('email-finder', { domain: t.domain, first_name: t.first, last_name: t.last }).catch(() => null)
      const d = j?.data
      const email: string | null = d?.email ?? null
      const status: string | null = d?.verification?.status ?? null
      const score: number = d?.score ?? 0
      rows.push({ ...t, email, status, score })
      if (email) {
        tally.found++
        const valid = status === 'valid', guess = !valid && score >= 85 && status !== 'invalid'
        if (valid) tally.valid++; else if (guess) tally.guessed++
        if (apply && (valid || guess)) {
          const taken = await prisma.crmPerson.findFirst({ where: { id: { not: t.id }, OR: [{ email }, { emails: { has: email } }] }, select: { id: true } })
          if (taken) { tally.takenByOther++; continue }
          await prisma.crmPerson.update({
            where: { id: t.id },
            data: valid
              ? { email, emailVerifiedStatus: 'valid', emailVerifiedAt: new Date(), emailSource: 'Hunter email finder' }
              : { guessedEmail: email, guessedEmailBasis: `Hunter email finder, status ${status ?? 'unknown'}, score ${score}` },
          })
          tally.written++
        }
      }
      await sleep(250)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  writeFileSync(out, JSON.stringify(rows, null, 1))
  console.log(tally, `Saved ${out}`)
  const rq = (await hunter('account', {}))?.data?.requests
  if (rq) console.log(`Hunter left: ${rq.searches?.remaining} searches, ${rq.verifications?.remaining} verifications`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
