// Monthly count of announced layoffs whose coverage ties them to AI.
//
// From LayoffNewsMention (headlines gathered by the layoff news check): a
// company counts as AI-attributed in the month of its first mention if any of
// its headlines says AI, artificial intelligence or automation. Jobs are the
// largest headcount any headline gives for that company, so ten articles about
// one announcement count once. This is what the coverage says the company
// claimed; it does not verify that AI was the cause (see the AI-washing gap in
// nc_openings_and_aiwashing.py for that check).
//
// Usage: npm run report:ai-layoffs
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'

// The news check started collecting in October 2026; earlier months hold only the
// odd stray article, so a count for them would read as a calm market that never
// existed. The series starts at the first month with real coverage.
const FIRST_FULL_MONTH = '2026-10'

const AI = /\bAI\b|artificial intelligence|automation|automat(e|ing)\b|machine learning/i

async function main() {
  const rows = await prisma.layoffNewsMention.findMany({
    where: { publishedAt: { not: null } },
    select: { companyKey: true, headline: true, employees: true, publishedAt: true },
  })
  const byCompany = new Map<string, { first: Date; ai: boolean; jobs: number }>()
  for (const r of rows) {
    const c = byCompany.get(r.companyKey) ?? { first: r.publishedAt!, ai: false, jobs: 0 }
    if (r.publishedAt! < c.first) c.first = r.publishedAt!
    if (AI.test(r.headline)) c.ai = true
    // An all-company headcount ("78,000 employees in firm") is not the cut; take only plausible cut sizes.
    if (r.employees && r.employees <= 60_000) c.jobs = Math.max(c.jobs, r.employees)
    byCompany.set(r.companyKey, c)
  }
  const months = new Map<string, { all: number; ai: number; allJobs: number; aiJobs: number }>()
  for (const c of byCompany.values()) {
    const m = c.first.toISOString().slice(0, 7)
    if (m < FIRST_FULL_MONTH) continue
    const s = months.get(m) ?? { all: 0, ai: 0, allJobs: 0, aiJobs: 0 }
    s.all++; s.allJobs += c.jobs
    if (c.ai) { s.ai++; s.aiJobs += c.jobs }
    months.set(m, s)
  }
  const lines = ['month,companies_all,companies_ai_attributed,ai_share_pct,jobs_all,jobs_ai_attributed']
  for (const [m, s] of [...months].sort()) {
    lines.push([m, s.all, s.ai, s.all ? Math.round((1000 * s.ai) / s.all) / 10 : '', s.allJobs, s.aiJobs].join(','))
  }
  const out = path.join(process.cwd(), 'public', 'reports', 'ai-layoffs-monthly.csv')
  fs.writeFileSync(out, lines.join('\n') + '\n')
  console.log(lines.join('\n'))
  await prisma.$disconnect()
}
main()
