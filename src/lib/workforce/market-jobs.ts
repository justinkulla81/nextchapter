import 'server-only'
import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { countSkills, type SkillCount } from './skills-dictionary'

export type MarketJobs = {
  sampled: number
  withPay: number
  medianMid: number | null
  byLevel: { level: string; n: number }[]
  skills: SkillCount[]
  aiShare: number
  companies: { name: string; n: number }[]
  titles: { title: string; company: string; level: string | null; min: number | null; max: number | null }[]
}

// One bounded read per city, shared for six hours: at most 250 live postings
// (title, company, level, pay, description) filtered to the city, newest
// first. The descriptions are what the skills are counted from.
export const marketJobs = memoTtl(
  6 * 3_600_000,
  (city: string, state: string) => `${city}|${state}`,
  async (city: string, state: string): Promise<MarketJobs> => {
    const now = new Date()
    const rows = await prisma.exclusiveJobPosting.findMany({
      where: {
        status: 'approved',
        archivedAt: null,
        location: { contains: city, mode: 'insensitive' },
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: [{ location: { contains: `, ${state}` } }, { location: { contains: state, mode: 'insensitive' } }] }],
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: { title: true, companyName: true, level: true, salaryMin: true, salaryMax: true, description: true },
    })
    const mids = rows.filter((r) => r.salaryMin && r.salaryMax).map((r) => ((r.salaryMin ?? 0) + (r.salaryMax ?? 0)) / 2).sort((a, b) => a - b)
    const lv = new Map<string, number>()
    for (const r of rows) lv.set(r.level ?? 'Not stated', (lv.get(r.level ?? 'Not stated') ?? 0) + 1)
    const co = new Map<string, number>()
    for (const r of rows) co.set(r.companyName, (co.get(r.companyName) ?? 0) + 1)
    const skills = countSkills(rows.map((r) => `${r.title}\n${r.description ?? ''}`))
    return {
      sampled: rows.length,
      withPay: mids.length,
      medianMid: mids.length ? Math.round(mids[Math.floor(mids.length / 2)]) : null,
      byLevel: [...lv].map(([level, n]) => ({ level, n })).sort((a, b) => b.n - a.n),
      skills,
      aiShare: skills.find((s) => s.skill === 'AI or generative AI')?.share ?? 0,
      companies: [...co].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 8),
      titles: rows.slice(0, 8).map((r) => ({ title: r.title, company: r.companyName, level: r.level, min: r.salaryMin, max: r.salaryMax })),
    }
  },
)
