/**
 * Attaches a contact, an official organization record and a prime/sub role to funding leads.
 *
 *   npm run crm:funding-contacts                dry run, no writes
 *   npm run crm:funding-contacts -- --commit
 *
 * Reads docs/funding/company-sweep/contacts_*.csv (one row per funding lead, written from the funder's own
 * page). A named person becomes a CRM person affiliated with the funder and set as the lead's primary contact;
 * a program mailbox, phone or contact form goes on the lead's next step; nothing is guessed. The role says what a
 * for-profit can be: PRIME applies directly, SUB joins a nonprofit, college or board that holds the grant,
 * CUSTOMER sells to the awardee, NONE cannot take part.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, type CrmEligibility } from '@prisma/client'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { strictOrgKey } from '../../src/lib/crm/normalize'
import { toRows } from './parse'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const FORCE = process.argv.includes('--force')
const DIR = join(process.cwd(), 'docs/funding/company-sweep')
const ROLE_ELIGIBILITY: Record<string, CrmEligibility | undefined> = {
  PRIME: 'FOR_PROFIT_ELIGIBLE', SUB: 'PARTNER_OR_RESEARCH', CUSTOMER: 'NONPROFIT_ONLY', NONE: 'NONPROFIT_ONLY',
}
const ROLE_LABEL: Record<string, string> = {
  PRIME: 'PRIME — we can apply directly',
  SUB: 'SUB — a nonprofit, college or board holds the grant; we join as subrecipient, subcontractor or vendor',
  CUSTOMER: 'CUSTOMER — the awardee buys; we sell to them after award',
  NONE: 'NOT ACCESSIBLE',
  UNKNOWN: 'ROLE UNKNOWN — page does not say',
}
const isEmail = (v: string | null): v is string => !!v && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

/** The pooled connection drops on a long run; reconnect and try the write once more. */
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn() } catch (e) {
    if ((e as { code?: string }).code !== 'P1017') throw e
    await prisma.$disconnect(); await prisma.$connect()
    return fn()
  }
}

async function main() {
  console.log(`FUNDING CONTACTS — ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)
  const files = readdirSync(DIR).filter((f) => /^contacts_.*\.csv$/.test(f)).sort()
  const rows = files.flatMap((f) => toRows(readFileSync(join(DIR, f), 'utf8')).map((r) => ({ r, f })))
  const opps = await prisma.crmOpportunity.findMany({
    where: { pipeline: { key: { in: ['grants', 'fundraising'] } } },
    select: { id: true, title: true, orgId: true, nextStep: true, eligibility: true, primaryPersonId: true, org: { select: { id: true, name: true, website: true } } },
  })
  const byTitle = new Map(opps.map((o) => [o.title.toLowerCase(), o]))
  const tally = { rows: 0, matched: 0, person: 0, office: 0, none: 0, newPeople: 0, linkedPeople: 0 }
  const roles = new Map<string, number>()
  const unmatched: string[] = []

  for (const { r } of rows) {
    tally.rows++
    const org = r.get('Organization'); const prog = r.get('Opportunity')
    if (!org || !prog) continue
    const opp = byTitle.get(`${org} — ${prog}`.slice(0, 180).toLowerCase())
    if (!opp) { unmatched.push(`${org} — ${prog}`); continue }
    tally.matched++
    if (COMMIT && !FORCE && (opp.nextStep ?? '').startsWith('Role:')) continue // already attached on an earlier run
    const role = (r.get('Role') ?? 'UNKNOWN').toUpperCase().split(/[^A-Z]/)[0]
    roles.set(role, (roles.get(role) ?? 0) + 1)
    const name = r.get('Contact Name'); const email = r.get('Contact Email'); const phone = r.get('Contact Phone')
    const type = (r.get('Contact Type') ?? '').toLowerCase()
    const personal = !!name && type.startsWith('person')
    if (personal) tally.person++; else if (email || phone || r.get('Contact Page URL')) tally.office++; else tally.none++

    const contactBits = [
      name ? `${name}${r.get('Contact Title') ? `, ${r.get('Contact Title')}` : ''}` : null,
      email, phone, r.get('Contact Page URL'),
    ].filter(Boolean).join(' · ')
    const note = [
      `Role: ${ROLE_LABEL[role] ?? ROLE_LABEL.UNKNOWN}${r.get('Likely Primes') ? `. Likely primes: ${r.get('Likely Primes')}` : ''}`,
      r.get('Eligibility Quote') ? `Eligibility says: "${r.get('Eligibility Quote')}"` : null,
      contactBits ? `Contact${personal ? '' : ' (office)'}: ${contactBits}${(r.get('Contact Verified') ?? '').toLowerCase().startsWith('yes') ? '' : ' (not verified)'}` : 'Contact: none published',
      r.get('Next Action') ? `Next: ${r.get('Next Action')}` : null,
    ].filter(Boolean).join('\n')
    if (!COMMIT) continue

    let personId: string | null = null
    if (personal) {
      let person = isEmail(email) ? await prisma.crmPerson.findFirst({ where: { email: email.toLowerCase() }, select: { id: true } }) : null
      if (!person) {
        person = await prisma.crmPerson.findFirst({
          where: { fullName: { equals: name!, mode: 'insensitive' }, affiliations: { some: { orgId: opp.orgId ?? undefined } } }, select: { id: true },
        })
      }
      if (!person) {
        person = await prisma.crmPerson.create({
          data: {
            fullName: name!, firstName: name!.split(' ')[0] ?? null, lastName: name!.split(' ').slice(1).join(' ') || null,
            email: isEmail(email) ? email.toLowerCase() : null, emails: isEmail(email) ? [email.toLowerCase()] : [],
            phone: phone ?? null, roles: ['GRANTS'], needsCompletion: true,
            notes: `Program contact for ${prog}, from ${r.get('Contact Page URL') ?? 'the funder page'}.`,
          },
          select: { id: true },
        })
        tally.newPeople++
      } else tally.linkedPeople++
      personId = person.id
      if (opp.orgId) {
        const has = await prisma.crmAffiliation.findFirst({ where: { personId, orgId: opp.orgId }, select: { id: true } })
        if (!has) await prisma.crmAffiliation.create({ data: { personId, orgId: opp.orgId, title: r.get('Contact Title') || null } })
      }
    }
    const previous = (opp.nextStep ?? '').trim()
    await retry(() => prisma.crmOpportunity.update({
      where: { id: opp.id },
      data: {
        nextStep: previous && !previous.startsWith('Role:') ? `${note}\nSource notes: ${previous}` : note,
        ...(personId && !opp.primaryPersonId ? { primaryPersonId: personId } : {}),
        ...(ROLE_ELIGIBILITY[role] ? { eligibility: ROLE_ELIGIBILITY[role] } : {}),
      },
    }))
    const site = r.get('Funder Domain')
    if (site && opp.org && !opp.org.website) {
      await prisma.crmOrganization.update({ where: { id: opp.org.id }, data: { website: /^https?:/.test(site) ? site : `https://${site}` } })
    }
  }
  console.log(tally, Object.fromEntries(roles))
  console.log(`unmatched rows: ${unmatched.length}`); for (const u of unmatched.slice(0, 15)) console.log('  ', u)
  if (!COMMIT) console.log('\nDry run only. Re-run with --commit to write.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
