/**
 * Hunter Email Finder for the named partner contacts that have no email: one search each.
 * A verified, high-score address becomes the email; anything weaker is stored only as a guess. Dry run unless --apply.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/partners-emails.ts [--apply]
 */
import { prisma } from '../../src/lib/prisma'
import { hunterAccount, hunterFindEmail, isTrustedEmail } from '../../src/lib/crm/hunter'

const RESERVE = 25
const hostOf = (w: string | null) => { if (!w) return null; try { return new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`).hostname.replace(/^www\./, '') } catch { return null } }
async function main() {
  const apply = process.argv.includes('--apply')
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, email: null, guessedEmail: null, notes: { contains: 'could sponsor, bundle or refer' } },
    select: { id: true, fullName: true, affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true, website: true } } } } },
  })
  const acct = await hunterAccount().catch(() => null)
  let left = acct ? acct.requests.searches.available - acct.requests.searches.used - RESERVE : 0
  console.log(`${people.length} partner contacts without an email; ${left} searches above the reserve`)
  let found = 0, guessed = 0, none = 0
  for (const p of people) {
    const domain = hostOf(p.affiliations[0]?.org.website ?? null)
    const parts = p.fullName.trim().split(/\s+/)
    if (!domain || parts.length < 2 || left <= 0) { none++; continue }
    left--
    const f = await hunterFindEmail(domain, parts[0], parts[parts.length - 1]).catch(() => null)
    if (!f?.email) { none++; continue }
    const trusted = isTrustedEmail(f.status ?? null, f.score ?? null)
    if (trusted) found++; else guessed++
    console.log(`${trusted ? 'verified' : 'guess   '} ${p.fullName} ${f.email} (${f.status}, ${f.score})`)
    if (!apply) continue
    if (trusted) await prisma.crmPerson.update({ where: { id: p.id }, data: { email: f.email, emails: [f.email] } })
    else await prisma.crmPerson.update({ where: { id: p.id }, data: { guessedEmail: f.email, guessedEmailBasis: `Hunter email finder, status ${f.status ?? 'unknown'}, score ${f.score ?? '?'}` } })
  }
  console.log(`${apply ? 'saved' : 'would save'}: ${found} verified, ${guessed} guesses kept aside, ${none} with nothing`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
