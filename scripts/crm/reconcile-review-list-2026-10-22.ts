// One-off: reconciles the CRM Review List (needs-completion) on 2026-10-22.
// Rules: merge only same-person records (same name AND same org/role, or a
// state-agency role already held by a complete record); different org/role =
// different person, so just approve. Dry run by default.
//
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/crm/reconcile-review-list-2026-10-22.ts [--apply]
import { prisma } from '../../src/lib/prisma'
import { mergePersonRecords } from '../../src/lib/crm/merge-person'
import { resolveFirmAsDifferent, resolveFirmAsSame } from '../../src/lib/search-firms/sync'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'

const apply = process.argv.includes('--apply')

// [source suffix, target suffix, drop source affiliations first]
const MERGES: [string, string][] = [
  ['1xz20b', 'nk08lj'], ['2j56qv', 'y3jshu'], ['sbzt9v', 'cq7b9u'], ['nvnfim', '0kmbt6'], ['xgvccj', 'xp5l5z'], ['vwr71h', '01rym5'],
  ['1urif8', 'q56w70'], ['50zjj9', '142xza'], ['oa6hr1', 'llyjle'], ['bkm1oi', '023at7'], ['0jf6wi', 'u2mkka'], ['cw78xc', '2i7d8p'],
  ['40bw4j', 'z8i5zc'], ['b7rn4o', '1vzn2n'], ['1wvqjm', '2zb3vi'], ['c3gdid', '866ry7'], ['s2nl00', 'i8cx1u'], ['60apy7', '4jqazi'],
  ['cvlls6', 'if7xxr'], ['ah6loo', 'ws25o1'], ['9zjs8b', 'ujx6lf'], ['blqc4f', 'jirfvh'], ['pex7hk', 's5kavg'], ['vprrzt', 'rda0i7'],
  ['8sdw8b', 'wadtvm'], ['xtgqae', 'figuhu'], ['ywmamn', 'cnzbak'], ['zvubqq', 'fw7laj'], ['52lyg7', '7yhrdg'],
  ['8bxgd7', 'xohgp3'], ['41rxam', 'xohgp3'], ['fi1crc', 'xohgp3'],
  ['yfnn6v', '45bwcb'], ['n2qjav', '45bwcb'], ['utamfb', '45bwcb'], ['e7k1e0', '45bwcb'], ['dewgk2', '45bwcb'],
  ['3gr5hn', 'lk3gpn'], ['gjmwis', 'ugfk7i'], ['xjfnr5', 'dd0hzw'], ['q07iza', 'mdjq01'], ['pminen', '1pfq6m'], ['1r0hm6', '9wm6nt'],
  ['3pcq1f', 'tcpfcv'], ['i4sbx1', 'iqv69i'], ['0vio48', 'gxgw42'], ['u1glr1', '2x7kmr'], ['mtdgxp', '8wjnwh'],
  ['67hbe4', 'p73we5'], ['xvlbx2', 'mso9bm'],
]
// Survivor is the flagged record (richer, or carries the right org): [source, target], keep source affiliations.
const MERGES_KEEP_AFF: [string, string][] = [['7bk2v4', '7dwvme']]
// Cleanup merge: the junk "Corporate Jobs" Greg Foran folds into the flagged Kroger one (org fixed below).
const SELF_OR_SYSTEM = ['769ch5', '1yybps', 'wpot26'] // justin@, vic@, facilities@adzuna.com
const ORG_FIX: Record<string, { org: string; title?: string }> = {
  '8eeutx': { org: 'Arsenal F.C.', title: 'Managing Director' },
  'xd3fg6': { org: 'Kroger', title: 'Chief Executive Officer' },
  'f8pxdz': { org: 'New Balance' },
  'mso9bm': { org: 'NASWA', title: 'NLx data team' },
}
const LINK_FIRMS = new Set(['938gv9', 'bdrizy', 'srlqrb', 'f6tfwb', 'ru2cwa', 'nq487h', 'fis6zj', 'rkp054', 'kt5prl', '28b9y8', 'pxcuv9', 'q1cmxo',
  'd9x001', 'tp7qzh', '9z39ob', '3c9xrn', '3pq8b5', 'q7t941', 'h63qnx', 's4iox0', 'e1737v', 'gzrr1g'])

async function merge(src: string, tgt: string) {
  for (let i = 0; i < 4; i++) {
    try { await mergePersonRecords(src, tgt); return } catch (e) {
      const gone = await prisma.crmPerson.findUnique({ where: { id: src }, select: { deletedAt: true } })
      if (gone?.deletedAt) return
      console.log(`  retry ${i + 1}: ${(e as Error).message.slice(0, 80)}`)
    }
  }
  throw new Error(`merge failed ${src}`)
}

async function byTail(tail: string) {
  const r = await prisma.crmPerson.findMany({ where: { id: { endsWith: tail } }, select: { id: true, fullName: true, deletedAt: true, coachId: true, recruiterId: true, candidateId: true } })
  if (r.length !== 1) throw new Error(`tail ${tail} matched ${r.length}`)
  return r[0]
}

async function main() {
  console.log(apply ? 'APPLY' : 'DRY RUN')
  for (const [s, t] of MERGES) {
    const [src, tgt] = [await byTail(s), await byTail(t)]
    if (src.deletedAt) { console.log(`skip ${src.fullName}: already gone`); continue }
    console.log(`merge "${src.fullName}" (${s}) -> "${tgt.fullName}" (${t})`)
    if (!apply) continue
    await prisma.crmAffiliation.deleteMany({ where: { personId: src.id } })
    await merge(src.id, tgt.id)
  }
  for (const [s, t] of MERGES_KEEP_AFF) {
    const [src, tgt] = [await byTail(s), await byTail(t)]
    console.log(`merge(keep aff) "${src.fullName}" (${s}) -> "${tgt.fullName}" (${t})`)
    if (apply && !src.deletedAt) await merge(src.id, tgt.id)
  }
  // Greg Foran: fix the flagged record first, then fold the junk one in.
  {
    const [flag, junk] = [await byTail('xd3fg6'), await byTail('967odt')]
    console.log(`merge "${junk.fullName}" (967odt, Corporate Jobs) -> flagged Greg Foran (xd3fg6)`)
    if (apply && !junk.deletedAt) {
      await prisma.crmAffiliation.deleteMany({ where: { personId: junk.id } })
      await merge(junk.id, flag.id)
    }
  }
  for (const [tail, fix] of Object.entries(ORG_FIX)) {
    const p = await byTail(tail)
    console.log(`org fix ${p.fullName}: ${fix.org}${fix.title ? ' / ' + fix.title : ''}`)
    if (!apply) continue
    const key = normalizeOrgName(fix.org)
    const org = await prisma.crmOrganization.upsert({ where: { canonicalNameNormalized: key }, create: { name: fix.org, canonicalNameNormalized: key, orgTypes: ['EMPLOYER'] }, update: {} })
    const aff = await prisma.crmAffiliation.findFirst({ where: { personId: p.id }, orderBy: { isPrimary: 'desc' } })
    const title = fix.title ?? aff?.title ?? ''
    if (aff) await prisma.crmAffiliation.update({ where: { id: aff.id }, data: { orgId: org.id, title } })
    else await prisma.crmAffiliation.create({ data: { personId: p.id, orgId: org.id, title, isPrimary: true } })
  }
  for (const tail of SELF_OR_SYSTEM) {
    const p = await byTail(tail)
    if (p.coachId || p.recruiterId || p.candidateId) { console.log(`KEEP ${p.fullName}: product account`); continue }
    console.log(`remove (self/system mailbox) ${p.fullName}`)
    if (apply) await prisma.crmPerson.update({ where: { id: p.id }, data: { deletedAt: new Date() } })
  }
  // Everyone left in the queue: reviewed, fine as-is.
  const left = await prisma.crmPerson.findMany({ where: { needsCompletion: true, deletedAt: null }, select: { id: true, fullName: true } })
  console.log(`approve as-is: ${left.length}`)
  if (apply) await prisma.crmPerson.updateMany({ where: { id: { in: left.map((l) => l.id) } }, data: { needsCompletion: false, completionClearedAt: new Date() } })
  // Search firms.
  const firms = await prisma.searchFirm.findMany({ where: { matchStatus: 'REVIEW', reviewOrgId: { not: null } }, select: { id: true, name: true } })
  let same = 0, diff = 0
  for (const f of firms) {
    const link = [...LINK_FIRMS].some((t) => f.id.endsWith(t))
    link ? same++ : diff++
    if (!apply) continue
    if (link) await resolveFirmAsSame(f.id)
    else await resolveFirmAsDifferent(f.id)
  }
  console.log(`firms: link ${same}, add as new ${diff}`)
  await prisma.$disconnect()
}
main()
