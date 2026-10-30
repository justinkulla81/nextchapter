/**
 * Runs Hunter's Email Verifier on guessed addresses from today's imports. A `valid` result becomes the person's email;
 * `invalid` or `disposable` clears the guess; anything else (accept_all, unknown) stays a guess. One verification each.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/verify-guesses.ts [max] [--apply]
 */
import { prisma } from '../../src/lib/prisma'
import { hunterAccount, hunterVerifyEmail } from '../../src/lib/crm/hunter'

async function main() {
  const apply = process.argv.includes('--apply'); const max = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 2000)
  const acct = await hunterAccount().catch(() => null)
  const left = acct ? acct.requests.verifications.available - acct.requests.verifications.used - 50 : 0
  const people = await prisma.crmPerson.findMany({
    where: { deletedAt: null, email: null, guessedEmail: { not: null }, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    select: { id: true, fullName: true, guessedEmail: true }, take: Math.min(max, left),
  })
  console.log(`${people.length} guesses to check (${left} verifications above reserve)`)
  const t = { valid: 0, invalid: 0, kept: 0, error: 0 }; let i = 0
  async function worker() {
    for (;;) {
      const p = people[i++]; if (!p) return
      const v = await hunterVerifyEmail(p.guessedEmail!).catch(() => null)
      if (!v) { t.error++; continue }
      if (v.status === 'valid') {
        t.valid++
        if (apply) await prisma.crmPerson.update({ where: { id: p.id }, data: { email: p.guessedEmail, emails: [p.guessedEmail!], guessedEmail: null, guessedEmailBasis: null } })
      } else if (v.status === 'invalid' || v.status === 'disposable') {
        t.invalid++
        if (apply) await prisma.crmPerson.update({ where: { id: p.id }, data: { guessedEmail: null, guessedEmailBasis: null } })
      } else t.kept++
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  console.log(t); await prisma.$disconnect()
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
