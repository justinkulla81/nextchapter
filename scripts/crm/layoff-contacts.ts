/**
 * Finds the real people named in the coverage of a layoff and puts them in the
 * CRM. The daily WARN sync does this for each layoff the news reports; this
 * runs it by hand, for one employer or to backfill.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/layoff-contacts.ts "Amazon" [days]
 *
 * Reads the news mentions of that employer from the last `days` (default 14),
 * and for the CRM organization of its newest WARN notice, if it has one.
 * Metered: one Claude Haiku 4.5 call, about a cent, reading at most three
 * articles. A name must appear in the article it is credited to.
 */
import { prisma } from '../../src/lib/prisma'
import { findLayoffContacts } from '../../src/lib/warn/layoff-contacts-run'

async function main() {
  const [name, days] = process.argv.slice(2)
  if (!name) { console.log('usage: "<employer name>" [days]'); return }
  const since = new Date(Date.now() - Number(days ?? 14) * 86_400_000)
  const mentions = await prisma.layoffNewsMention.findMany({
    where: { company: { contains: name, mode: 'insensitive' }, OR: [{ publishedAt: { gte: since } }, { publishedAt: null, createdAt: { gte: since } }] },
    orderBy: { publishedAt: 'desc' },
  })
  console.log(`${mentions.length} mention(s) of ${name} since ${since.toISOString().slice(0, 10)}`)
  if (!mentions.length) return
  const notice = await prisma.warnNotice.findFirst({
    where: { employer: { equals: mentions[0].company, mode: 'insensitive' }, dismissedAt: null }, orderBy: { noticeDate: 'desc' },
    select: { promotedOrgId: true },
  })
  const employees = mentions.map((m) => m.employees).find((n) => n != null) ?? null
  const r = await findLayoffContacts({
    employer: mentions[0].company, employees, date: mentions[0].publishedAt, orgId: notice?.promotedOrgId, urls: mentions.map((m) => m.url),
  })
  console.log(r)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
