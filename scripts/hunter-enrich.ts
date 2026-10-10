/**
 * Finds and verifies CRM emails with Hunter.io, within a credit budget.
 *
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/hunter-enrich.ts            # dry run: shows what it would spend
 *   … scripts/hunter-enrich.ts --apply --max-searches 200 --max-verifications 200
 *
 * In order:
 *   1. Search-firm contacts with a guessed email: verify the guess.
 *   2. Search-firm contacts with no usable address: Email Finder.
 *   3. Search firms with live searches but no contacts: Domain Search for
 *      senior people (partners, managing directors, recruiters).
 *   4. P0–P2 CRM people with no email: Email Finder at their organization's domain.
 *
 * Only an address Hunter verifies as deliverable with a score of 90+ is
 * written as someone's real email (and the guess is cleared). Anything
 * weaker is kept as a labelled guess; an address Hunter says is invalid is
 * removed. Nothing is ever sent.
 */
import { prisma } from '@/lib/prisma'
import {
  hunterAccount,
  hunterConfigured,
  hunterDomainSearch,
  hunterFindEmail,
  hunterVerifyEmail,
  isTrustedEmail,
} from '@/lib/crm/hunter'
import { addContactToCrm } from '@/lib/crm/add-contact'
import { findEmailOwner } from '@/lib/crm/email-owner'
import { contactRank } from '@/lib/search-firms/match'

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? Number(process.argv[i + 1]) : fallback
}
const APPLY = process.argv.includes('--apply')
const budget = { searches: arg('--max-searches', 50), verifications: arg('--max-verifications', 50) }
const spent = { searches: 0, verifications: 0 }
const tally = { verified: 0, guessKept: 0, guessRemoved: 0, found: 0, foundWeak: 0, peopleAdded: 0, notFound: 0 }

const domainOf = (url: string | null | undefined) => {
  if (!url) return null
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

function splitName(full: string): { first: string; last: string } | null {
  const parts = full.replace(/[,(].*$/, '').trim().split(/\s+/)
  return parts.length >= 2 ? { first: parts[0], last: parts[parts.length - 1] } : null
}

async function setEmail(personId: string, email: string, basis: string) {
  if (!APPLY) return
  if (await findEmailOwner(email, { includeDeleted: true })) return // someone else already has it
  await prisma.crmPerson.update({
    where: { id: personId },
    data: { email, emails: { push: email }, guessedEmail: null, guessedEmailBasis: null, notes: undefined },
  })
  void basis
}

async function setGuess(personId: string, email: string | null, basis: string | null) {
  if (!APPLY) return
  await prisma.crmPerson.update({ where: { id: personId }, data: { guessedEmail: email, guessedEmailBasis: basis } })
}

async function findFor(personId: string, fullName: string, domain: string, label: string) {
  if (spent.searches >= budget.searches) return
  const name = splitName(fullName)
  if (!name) return
  spent.searches++
  const r = APPLY ? await hunterFindEmail(domain, name.first, name.last) : null
  if (!APPLY) return
  if (!r?.email) return void tally.notFound++
  if (isTrustedEmail(r.status, r.score)) {
    await setEmail(personId, r.email, label)
    tally.found++
  } else {
    await setGuess(personId, r.email, `Hunter Email Finder (${r.status ?? 'unverified'}, score ${r.score ?? '?'}) — not confirmed deliverable`)
    tally.foundWeak++
  }
}

async function main() {
  if (!hunterConfigured()) {
    console.log('HUNTER_API_KEY is not set — add it to .env.local (and Vercel if the app should use it).')
  } else {
    const acct = await hunterAccount()
    if (acct) {
      console.log(
        `Hunter ${acct.plan_name}: searches ${acct.requests.searches.used}/${acct.requests.searches.available}, verifications ${acct.requests.verifications.used}/${acct.requests.verifications.available}`
      )
    }
  }

  // Search-firm organizations and their domains.
  const firms = await prisma.searchFirm.findMany({
    where: { crmOrgId: { not: null } },
    select: { name: true, domain: true, website: true, liveSearchCount: true, crmOrgId: true },
    orderBy: { liveSearchCount: 'desc' },
  })
  const firmDomain = new Map(firms.map((f) => [f.crmOrgId!, f.domain ?? domainOf(f.website)]))

  const firmPeople = await prisma.crmAffiliation.findMany({
    where: { isCurrent: true, orgId: { in: [...firmDomain.keys()] }, person: { deletedAt: null, mergedIntoId: null, email: null } },
    select: { orgId: true, title: true, person: { select: { id: true, fullName: true, guessedEmail: true } } },
  })

  // 1. Verify guesses.
  const guessed = firmPeople.filter((a) => a.person.guessedEmail)
  for (const a of guessed) {
    if (spent.verifications >= budget.verifications) break
    spent.verifications++
    if (!APPLY) continue
    const v = await hunterVerifyEmail(a.person.guessedEmail!)
    if (v && isTrustedEmail(v.status, v.score)) {
      await setEmail(a.person.id, a.person.guessedEmail!, 'Hunter verified')
      tally.verified++
    } else if (v?.status === 'invalid') {
      await setGuess(a.person.id, null, null)
      tally.guessRemoved++
    } else {
      tally.guessKept++
    }
  }

  // 2. Find addresses for firm contacts still without one (including guesses Hunter just rejected).
  for (const a of firmPeople) {
    const domain = firmDomain.get(a.orgId)
    if (!domain) continue
    const fresh = APPLY ? await prisma.crmPerson.findUnique({ where: { id: a.person.id }, select: { email: true, guessedEmail: true } }) : a.person
    if (fresh?.email || (fresh && 'guessedEmail' in fresh && fresh.guessedEmail && APPLY)) continue
    await findFor(a.person.id, a.person.fullName, domain, 'Hunter Email Finder')
  }

  // 3. Firms with live searches but nobody in the CRM: senior people from Domain Search.
  const withPeople = new Set(firmPeople.map((a) => a.orgId))
  const staffed = await prisma.crmAffiliation.findMany({ where: { isCurrent: true, orgId: { in: [...firmDomain.keys()] } }, select: { orgId: true } })
  for (const s of staffed) withPeople.add(s.orgId)
  const empty = firms.filter((f) => f.liveSearchCount > 0 && !withPeople.has(f.crmOrgId!) && firmDomain.get(f.crmOrgId!))
  for (const f of empty) {
    if (spent.searches >= budget.searches) break
    spent.searches++
    if (!APPLY) continue
    const r = await hunterDomainSearch(firmDomain.get(f.crmOrgId!)!, 10)
    for (const p of r?.people ?? []) {
      if (!p.firstName || !p.lastName || contactRank(p.position) < 0 || !p.position) continue
      const trusted = isTrustedEmail(p.status, p.confidence)
      const out = await addContactToCrm({
        fullName: `${p.firstName} ${p.lastName}`,
        title: p.position,
        email: trusted ? p.email.toLowerCase() : null,
        guessedEmail: trusted ? null : p.email.toLowerCase(),
        guessedEmailBasis: trusted ? null : `Hunter Domain Search (confidence ${p.confidence ?? '?'}, ${p.status ?? 'unverified'}) — not confirmed deliverable`,
        orgId: f.crmOrgId!,
        orgName: f.name,
        roles: ['BD_PARTNER'],
        goals: ['BD'],
        priority: 'P2',
        note: `${p.position} at ${f.name}. Found with Hunter Domain Search.`,
      })
      if (out.outcome === 'added') tally.peopleAdded++
    }
  }

  // 4. P0–P2 people with no email, at organizations whose domain we know.
  const priority = await prisma.crmPerson.findMany({
    where: { deletedAt: null, mergedIntoId: null, email: null, priority: { in: ['P0', 'P1', 'P2'] } },
    select: {
      id: true,
      fullName: true,
      affiliations: { where: { isCurrent: true }, select: { org: { select: { emailDomain: true, website: true } } }, take: 1 },
    },
    orderBy: { priority: 'asc' },
  })
  for (const p of priority) {
    const org = p.affiliations[0]?.org
    const domain = org?.emailDomain ?? domainOf(org?.website)
    if (domain) await findFor(p.id, p.fullName, domain, 'Hunter Email Finder')
  }

  console.log(
    `${APPLY ? 'Applied' : 'Dry run'} — searches ${spent.searches}/${budget.searches}, verifications ${spent.verifications}/${budget.verifications}`
  )
  console.log(
    `  candidates: ${guessed.length} firm guesses to verify, ${firmPeople.length} firm contacts without email, ${empty.length} firms with no contacts, ${priority.length} P0–P2 people without email`
  )
  if (APPLY) console.log('  results:', tally)
  await prisma.$disconnect()
}

main()
