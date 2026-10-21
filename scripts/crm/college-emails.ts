/**
 * Finds an email for each college contact that has a name but no address: Hunter's Email Finder on the college's domain, one search each.
 * A verified, high-score address is saved as the contact's email; anything weaker is kept only as a guess. Dry run unless --apply.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/crm/college-emails.ts [--apply]
 */
import { prisma } from '../../src/lib/prisma'
import { hunterAccount, hunterFindEmail, isTrustedEmail } from '../../src/lib/crm/hunter'

const RESERVE = 50
const hostOf = (w: string | null) => { if (!w) return null; try { return new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`).hostname.replace(/^www\./, '') } catch { return null } }

async function main() {
  const apply = process.argv.includes('--apply')
  const rows = await prisma.collegeContact.findMany({ where: { email: null, name: { not: null }, crmPersonId: { not: null } }, select: { id: true, collegeId: true, name: true, crmPersonId: true } })
  const colleges = new Map((await prisma.collegeProfile.findMany({ where: { unitid: { in: [...new Set(rows.map((r) => r.collegeId))] } }, select: { unitid: true, website: true } })).map((c) => [c.unitid, hostOf(c.website)]))
  const acct = await hunterAccount().catch(() => null)
  let left = acct ? acct.requests.searches.available - acct.requests.searches.used - RESERVE : 0
  console.log(`${rows.length} contacts without an email; ${left} searches available above the reserve`)
  let found = 0, guessed = 0, none = 0
  for (const r of rows) {
    const domain = colleges.get(r.collegeId)
    const parts = (r.name ?? '').trim().split(/\s+/)
    if (!domain || parts.length < 2 || left <= 0) { none++; continue }
    left--
    const f = await hunterFindEmail(domain, parts[0], parts[parts.length - 1]).catch(() => null)
    if (!f?.email) { none++; continue }
    const trusted = isTrustedEmail(f.status ?? null, f.score ?? null)
    if (trusted) found++; else guessed++
    if (!apply) continue
    if (trusted) {
      await prisma.collegeContact.update({ where: { id: r.id }, data: { email: f.email } })
      await prisma.crmPerson.update({ where: { id: r.crmPersonId! }, data: { email: f.email, emails: [f.email] } })
    } else {
      await prisma.collegeContact.update({ where: { id: r.id }, data: { guessedEmail: f.email, guessedEmailBasis: 'Hunter email finder, not verified' } })
    }
  }
  console.log(`${apply ? 'saved' : 'would save'}: ${found} verified emails, ${guessed} unverified guesses kept aside, ${none} with nothing`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
