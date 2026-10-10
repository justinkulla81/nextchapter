/**
 * Puts a Hunter pass into the CRM. Dry run unless --apply.
 *
 *   npx tsx --conditions react-server scripts/crm/hunter-import.ts <dir> [--apply]
 *
 * <dir> holds the three CSVs a Hunter pass produces:
 *   1-verified-emails.csv                    Email Verifier on guessed + real addresses
 *   2-found-emails.csv                       Email Finder, for people with no address
 *   3-new-contacts-from-domain-search.csv    Domain Search, named people at organizations
 *
 * What it does, and the rules it keeps:
 *   - Only a `valid` / `deliverable` result ever becomes an address. A
 *     `risky` (catch-all domain) or `undeliverable` result is recorded on the
 *     person, never written into `email`.
 *   - One address belongs to one person: an address someone already has is
 *     skipped, never moved (findEmailOwner).
 *   - A guess that verifies becomes the real email and the guess is cleared.
 *   - People from Domain Search go in through addContactToCrm, and a new one
 *     is flagged for the Review List — a person confirms it, nothing is
 *     merged on a guess.
 *   - Nothing is deleted, and a removed person is never brought back.
 *
 * Needs the four CrmPerson verification columns (prisma/manual/hunter-verification.sql).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/prisma'
import { findEmailOwner, canonicalEmail } from '@/lib/crm/email-owner'
import { addContactToCrm, ensureOrg } from '@/lib/crm/add-contact'
import { goalsForRoles } from '@/lib/crm/goals'
import type { CrmPersonRole } from '@prisma/client'

const MIN_CONFIDENCE = 70

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

const read = (dir: string, f: string) => parseCsv(readFileSync(join(dir, f), 'utf8'))
const status = (r: string) => (r === 'valid' || r === 'deliverable' ? 'deliverable' : r === 'accept_all' || r === 'risky' ? 'risky' : r)

function rolesFor(orgTypes: string[]): CrmPersonRole[] {
  if (orgTypes.includes('VC_FUND')) return ['INVESTOR_VC']
  if (orgTypes.includes('FUNDER_GRANT')) return ['GRANTS']
  return ['HIRING_MANAGER'] // employers and outplacement leads: the HR/people leader
}

async function main() {
  const dir = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!dir) throw new Error('usage: hunter-import.ts <dir> [--apply]')

  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'CrmPerson' AND column_name = 'emailVerifiedStatus'`
  if (apply && cols.length === 0) throw new Error('CrmPerson.emailVerifiedStatus does not exist — apply prisma/manual/hunter-verification.sql first')
  const hasCols = cols.length > 0

  const stamp = new Date()
  const n = { verifiedRecorded: 0, guessPromoted: 0, foundSet: 0, skippedOwned: 0, skippedNotValid: 0, skippedHasEmail: 0, domainAdded: 0, domainMatched: 0, domainReview: 0, domainRemoved: 0, domainSkipped: 0, warnAdded: 0, warnMatched: 0, warnReview: 0, warnSkipped: 0 }

  // 1. Verifier results on guessed and real addresses.
  for (const r of read(dir, '1-verified-emails.csv')) {
    const st = status(r.hunterResult)
    const p = await prisma.crmPerson.findUnique({ where: { id: r.id }, select: { email: true, guessedEmail: true, deletedAt: true } })
    if (!p || p.deletedAt) continue
    const isGuess = r.kind.startsWith('guessed') || (!!p.guessedEmail && !p.email)
    if (isGuess) {
      if (st !== 'deliverable') { n.skippedNotValid++; continue }
      if (p.email) { n.skippedHasEmail++; continue }
      if (await findEmailOwner(r.email, { excludePersonId: r.id })) { n.skippedOwned++; continue }
      n.guessPromoted++
      if (apply) await prisma.crmPerson.update({
        where: { id: r.id },
        data: { email: r.email.toLowerCase(), emails: [r.email.toLowerCase()], guessedEmail: null, guessedEmailBasis: null,
          emailVerifiedStatus: 'deliverable', emailVerifiedAt: stamp, emailVerifyScore: Number(r.score) || null, emailSource: 'hunter-guess-verified' },
      })
    } else {
      n.verifiedRecorded++
      if (apply && p.email && canonicalEmail(p.email) === canonicalEmail(r.email)) await prisma.crmPerson.update({
        where: { id: r.id },
        data: { emailVerifiedStatus: st, emailVerifiedAt: stamp, emailVerifyScore: Number(r.score) || null },
      })
    }
  }

  // 2. Email Finder: an address for someone who had none.
  for (const r of read(dir, '2-found-emails.csv')) {
    if (status(r.verification) !== 'deliverable' || Number(r.confidence) < MIN_CONFIDENCE) { n.skippedNotValid++; continue }
    const p = await prisma.crmPerson.findUnique({ where: { id: r.id }, select: { email: true, deletedAt: true } })
    if (!p || p.deletedAt) continue
    if (p.email) { n.skippedHasEmail++; continue }
    if (await findEmailOwner(r.foundEmail, { excludePersonId: r.id })) { n.skippedOwned++; continue }
    n.foundSet++
    if (apply) await prisma.crmPerson.update({
      where: { id: r.id },
      data: { email: r.foundEmail.toLowerCase(), emails: [r.foundEmail.toLowerCase()], guessedEmail: null, guessedEmailBasis: null,
        emailVerifiedStatus: 'deliverable', emailVerifiedAt: stamp, emailVerifyScore: Number(r.confidence) || null, emailSource: 'hunter-finder' },
    })
  }

  // 3. Domain Search: new named people at organizations.
  for (const r of read(dir, '3-new-contacts-from-domain-search.csv')) {
    if (status(r.verification) !== 'deliverable' || Number(r.confidence) < MIN_CONFIDENCE || !r.first || !r.last) { n.domainSkipped++; continue }
    const org = await prisma.crmOrganization.findUnique({ where: { id: r.orgId }, select: { id: true, name: true, orgTypes: true } })
    if (!org) { n.domainSkipped++; continue }
    if (await findEmailOwner(r.email)) { n.skippedOwned++; continue }
    const roles = rolesFor(r.orgTypes ? r.orgTypes.split('|') : org.orgTypes)
    n.domainAdded++
    if (!apply) continue
    const res = await addContactToCrm({
      fullName: `${r.first} ${r.last}`.trim(), title: r.position || null, email: r.email.toLowerCase(),
      orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: null,
      note: `Found by Hunter Domain Search at ${r.domain} (confidence ${r.confidence}, verified ${stamp.toISOString().slice(0, 10)}). Confirm this is the right person and role before outreach.`,
    })
    if (res.outcome === 'removed') { n.domainAdded--; n.domainRemoved++; continue }
    // A new person from an outside list is confirmed by a person, not assumed.
    if (res.outcome === 'added') {
      await prisma.crmPerson.update({
        where: { id: res.personId },
        data: { needsCompletion: true, emailVerifiedStatus: 'deliverable', emailVerifiedAt: stamp, emailVerifyScore: Number(r.confidence) || null, emailSource: 'hunter-domain-search' },
      })
    } else {
      n.domainAdded--
      if (res.outcome === 'review') n.domainReview++
      else n.domainMatched++
    }
  }

  // 4. WARN-employer HR contacts (4-warn-hr-contacts.csv, optional): the HR or
  // workforce leader at an employer with a recent WARN notice. Same rules as
  // Domain Search; the employer's organization is the one already there, else
  // a new employer record.
  let warnRows: Record<string, string>[] = []
  try { warnRows = read(dir, '4-warn-hr-contacts.csv') } catch { /* file is optional */ }
  for (const r of warnRows) {
    if (status(r.verification) !== 'deliverable' || Number(r.confidence) < MIN_CONFIDENCE || !r.first || !r.last) { n.warnSkipped++; continue }
    if (await findEmailOwner(r.email)) { n.skippedOwned++; continue }
    n.warnAdded++
    if (!apply) continue
    const org = await ensureOrg({ name: r.employer, type: 'EMPLOYER', website: r.domain ? `https://${r.domain}` : null, state: r.state || null })
    const roles: CrmPersonRole[] = ['HIRING_MANAGER']
    const res = await addContactToCrm({
      fullName: `${r.first} ${r.last}`.trim(), title: r.position || null, email: r.email.toLowerCase(),
      orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: null,
      note: `warn-hr: ${r.employer} filed a WARN notice (${r.noticeDate || 'recent'}). Found by Hunter Domain Search (confidence ${r.confidence}). Confirm the person and role before outreach.`,
    })
    if (res.outcome === 'added') {
      await prisma.crmPerson.update({
        where: { id: res.personId },
        data: { needsCompletion: true, emailVerifiedStatus: 'deliverable', emailVerifiedAt: stamp, emailVerifyScore: Number(r.confidence) || null, emailSource: 'hunter-domain-search' },
      })
    } else if (res.outcome === 'review') { n.warnAdded--; n.warnReview++ }
    else if (res.outcome === 'matched') { n.warnAdded--; n.warnMatched++ }
    else { n.warnAdded--; n.warnSkipped++ }
  }

  console.log(apply ? 'APPLIED' : 'DRY RUN (no writes)', hasCols ? '' : '(verification columns not present yet)')
  console.table(n)
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
