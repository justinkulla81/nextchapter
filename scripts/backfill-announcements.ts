// Files researched, press- or company-confirmed layoffs as MANUAL_ANNOUNCEMENT rows so each company gets a layoff page.
// Unlike announceLayoff (src/lib/warn/layoff-announce.ts) it sends no alert email and looks up no contacts: it is for a backlog
// of past announcements, not a new one. Dry run by default; pass --apply to write.
// Run: npx tsx --conditions react-server --env-file=.env.local scripts/backfill-announcements.ts file1.json [file2.json ...] [--apply]
import { readFileSync } from 'node:fs'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { matchOrCreateCompanyForEmployer } from '@/lib/warn/company-match'
import { sameEmployer } from '@/lib/warn/sec-8k'

const COVERED_DAYS = 45
const BASES = new Set(['company-confirmed', 'sec-filing', 'two-outlets'])

interface Entry {
  company: string
  noticeDate: string
  employees: number | null
  percent: number | null
  state: string | null
  summary: string
  sourceUrl: string
  secondSourceUrl: string | null
  basis: string
}

function problems(e: Entry): string[] {
  const out: string[] = []
  if (!e.company || e.company.length > 120) out.push('company')
  if (!/^2026-\d\d-\d\d$/.test(e.noticeDate) || new Date(`${e.noticeDate}T00:00:00Z`).getTime() > Date.now()) out.push('date')
  if (!/^https:\/\//.test(e.sourceUrl ?? '')) out.push('sourceUrl')
  if (!BASES.has(e.basis)) out.push('basis')
  if (e.basis === 'two-outlets' && !/^https:\/\//.test(e.secondSourceUrl ?? '')) out.push('second source')
  if (!e.summary || e.summary.length < 20 || e.summary.length > 300) out.push('summary')
  if (e.state && !/^[A-Z]{2}$/.test(e.state)) out.push('state')
  if (e.employees != null && (!Number.isInteger(e.employees) || e.employees < 1)) out.push('employees')
  return out
}

async function main() {
  const apply = process.argv.includes('--apply')
  const files = process.argv.slice(2).filter((a) => a.endsWith('.json'))
  const entries: Entry[] = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as Entry[])
  let filed = 0, skipped = 0
  for (const e of entries) {
    const bad = problems(e)
    if (bad.length) { console.log(`SKIP ${e.company}: invalid ${bad.join(', ')}`); skipped++; continue }
    const key = normalizeOrgName(e.company)
    const when = new Date(`${e.noticeDate}T00:00:00Z`)
    if (await prisma.warnNotice.findFirst({ where: { sourceUrl: e.sourceUrl }, select: { id: true } })) { console.log(`SKIP ${e.company}: source already filed`); skipped++; continue }
    const near = await prisma.warnNotice.findMany({
      where: { dismissedAt: null, noticeDate: { gte: new Date(when.getTime() - COVERED_DAYS * 86_400_000), lte: new Date(when.getTime() + COVERED_DAYS * 86_400_000) } },
      select: { normalizedEmployer: true, sourceUrl: true },
    })
    // A layoffs.fyi row never gets a page of its own (src/lib/warn/company-announcements.ts leaves it out), so it does not count as covering the company.
    if (near.filter((n) => !/layoffs\.fyi/i.test(n.sourceUrl ?? '')).some((n) => sameEmployer(n.normalizedEmployer, key))) { console.log(`SKIP ${e.company}: already covered within ${COVERED_DAYS} days`); skipped++; continue }
    console.log(`${apply ? 'FILE' : 'WOULD FILE'} ${e.company} ${e.noticeDate} ${e.employees ?? '-'} (${e.basis}) ${e.sourceUrl}`)
    if (!apply) { filed++; continue }
    const match = await matchOrCreateCompanyForEmployer(e.company).catch(() => null)
    await prisma.warnNotice.create({
      data: {
        ...(match ? { companyId: match.companyId, companyMatchStatus: match.status, ...(match.candidates ? { companyMatchCandidates: match.candidates } : {}) } : {}),
        employer: e.company,
        normalizedEmployer: key,
        source: 'MANUAL_ANNOUNCEMENT',
        state: e.state ?? null,
        noticeDate: when,
        employees: e.employees ?? null,
        sourceUrl: e.sourceUrl,
        layoffType: e.summary,
      },
    })
    filed++
  }
  console.log(`${apply ? 'filed' : 'would file'} ${filed}, skipped ${skipped}`)
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
