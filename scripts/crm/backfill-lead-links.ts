/**
 * Fills each funding lead's program link from the source sheet's "Link" column.
 *
 *   npm run crm:lead-links -- --file <funding.csv>            dry run
 *   npm run crm:lead-links -- --file <funding.csv> --commit
 *
 * The importer kept the link only on the organization (first row wins) and on a deadline, so a
 * funder with several programs showed one page for all of them. Leads are matched on the title
 * the importer built ("Org — Program"), then on the program name alone. Only empty urls are filled.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { toRows } from './parse'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const FILE = (() => {
  const i = process.argv.indexOf('--file')
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : ''
})()
const isUrl = (v: string | null): v is string => !!v && /^https?:\/\//i.test(v)

async function main() {
  console.log(`LEAD LINKS — ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)
  if (!FILE) { console.error('pass --file <funding.csv>'); process.exit(1) }
  const rows = toRows(readFileSync(FILE, 'utf8'))
  const byTitle = new Map<string, string>()
  const byProgram = new Map<string, string[]>()
  for (const r of rows) {
    const link = r.get('Link'); const org = r.get('Organization'); const prog = r.get('Program')
    if (!isUrl(link) || !org) continue
    byTitle.set(`${org} — ${prog ?? 'funding'}`.slice(0, 180).toLowerCase(), link)
    if (prog) byProgram.set(prog.toLowerCase(), [...(byProgram.get(prog.toLowerCase()) ?? []), link])
  }

  const leads = await prisma.crmOpportunity.findMany({
    where: { pipeline: { key: { in: ['grants', 'fundraising'] } }, url: null },
    select: { id: true, title: true, org: { select: { website: true } } },
  })
  let exact = 0, program = 0, orgSite = 0, none = 0
  for (const l of leads) {
    let url = byTitle.get(l.title.toLowerCase()) ?? null
    if (url) exact++
    else {
      const prog = l.title.includes(' — ') ? l.title.split(' — ').slice(1).join(' — ').toLowerCase() : ''
      const hits = byProgram.get(prog)
      if (hits && new Set(hits).size === 1) { url = hits[0]; program++ }
    }
    if (!url && isUrl(l.org?.website ?? null)) { url = l.org!.website; orgSite++ }
    if (!url) { none++; continue }
    if (COMMIT) await prisma.crmOpportunity.update({ where: { id: l.id }, data: { url } })
  }
  console.log(`leads without a link ${leads.length}: matched by title ${exact}, by program ${program}, from the organization site ${orgSite}, still none ${none}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
