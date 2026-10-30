/**
 * Hunter Email Finder for named contacts that have no email, by group. One search per person (charged only when an address is found).
 * A `valid` high-score address becomes the email; a weaker one is stored only as a guess. Then run verify-guesses.ts to check the guesses.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/fill-emails.ts <alumni|grad|partners|highered> [max] [--apply]
 */
import { prisma } from '../../src/lib/prisma'
import { hunterAccount, hunterFindEmail, isTrustedEmail } from '../../src/lib/crm/hunter'

const hostOf = (w: string | null) => { if (!w) return null; try { return new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`).hostname.replace(/^www\./, '') } catch { return null } }
const WHERE: Record<string, object> = {
  alumni: { roles: { has: 'ALUMNI_OFFICE' } },
  grad: { notes: { contains: 'Graduate-school' } },
  partners: { notes: { contains: 'could sponsor, bundle or refer' } },
  highered: { notes: { contains: 'Higher-ed lead for career' } },
}
async function main() {
  const group = process.argv[2]; const apply = process.argv.includes('--apply'); const max = Number(process.argv.find((a, i) => i > 2 && /^\d+$/.test(a)) ?? 5000)
  if (!WHERE[group]) throw new Error('group: alumni | grad | partners | highered')
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, email: null, guessedEmail: null, ...WHERE[group] } as never,
    select: { id: true, fullName: true, affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { website: true, emailDomain: true } } } } },
  })
  const acct = await hunterAccount().catch(() => null)
  let left = Math.min(max, acct ? acct.requests.searches.available - acct.requests.searches.used - 200 : 0)
  console.log(`${group}: ${people.length} without an email; budget ${left} searches`)
  let found = 0, guessed = 0, none = 0, i = 0
  async function worker() {
    for (;;) {
      const p = people[i++]; if (!p) return
      const o = p.affiliations[0]?.org; const domain = o?.emailDomain ?? hostOf(o?.website ?? null)
      const parts = p.fullName.trim().split(/\s+/)
      if (!domain || parts.length < 2 || left <= 0) { none++; continue }
      left--
      const f = await hunterFindEmail(domain, parts[0], parts[parts.length - 1]).catch(() => null)
      if (!f?.email) { none++; continue }
      const trusted = isTrustedEmail(f.status ?? null, f.score ?? null)
      if (trusted) found++; else guessed++
      if (!apply) continue
      if (trusted) await prisma.crmPerson.update({ where: { id: p.id }, data: { email: f.email, emails: [f.email] } })
      else await prisma.crmPerson.update({ where: { id: p.id }, data: { guessedEmail: f.email, guessedEmailBasis: `Hunter email finder, status ${f.status ?? 'unknown'}, score ${f.score ?? '?'}` } })
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  console.log(`${apply ? 'saved' : 'would save'}: ${found} verified, ${guessed} guesses kept aside, ${none} with nothing`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
