// Business Hub › Expansion leads: companies that could move to or expand into a region (owner, 2026-11-17).
//
// Two sources, both shared across server instances and refreshed at most every 12 hours:
//   1. News: recent stories of companies opening offices, expanding, or moving headquarters (Google News RSS, the same
//      search the layoff tracker uses), phrased the way such headlines are written.
//   2. Our own hiring data: the companies whose open roles grew most over 12 weeks (CompanySignal, trajectory "growing").
// Neither says a company is considering this region; they are who is growing and moving, for the organization to pitch.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { sharedLoad } from '@/lib/db/heavy'
import { searchGoogleNews } from '@/lib/news/discover'

export type ExpansionStory = { title: string; url: string; source: string | null; publishedAt: string | null }
export type GrowingCompany = { name: string; openRoles: number; added12wk: number; topFunctions: string[] }

const QUERIES = [
  '"opening new office"',
  '"new headquarters" company',
  '"expanding operations" jobs',
  '"to open new facility"',
  '"relocating headquarters to"',
  '"new regional office"',
  '"will create" jobs expansion',
]
// Headlines about cutting or closing are layoffs, not leads.
const NOT_A_LEAD = /\b(layoffs?|lay off|cuts?|cutting|clos(e|es|ing|ure)|shut(s|ting)? down|bankrupt\w*|exits?|leaving|leaves|lawsuit|sued)\b/i

export async function expansionNews(): Promise<ExpansionStory[]> {
  return sharedLoad('business-expansion-news-v1', 12 * 3600, async () => {
    const seen = new Set<string>()
    const out: ExpansionStory[] = []
    for (const q of QUERIES) {
      const found = await searchGoogleNews(q, { days: 14 }).catch(() => [])
      for (const a of found) {
        const key = a.title.toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 80)
        if (seen.has(key) || NOT_A_LEAD.test(a.title)) continue
        seen.add(key)
        out.push({ title: a.title, url: a.url, source: a.source, publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : null })
      }
    }
    return out.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')).slice(0, 40)
  })
}

// One query over the newest week of signals (about 66k narrow rows scanned in the database, 15 returned), shared for 12 hours.
export async function growingCompanies(): Promise<GrowingCompany[]> {
  return sharedLoad('business-growing-companies-v1', 12 * 3600, async () => {
    const latest = await prisma.companySignal.findFirst({ orderBy: { weekStartDate: 'desc' }, select: { weekStartDate: true } })
    if (!latest) return []
    const rows = await prisma.companySignal.findMany({
      where: { weekStartDate: latest.weekStartDate, trajectory: 'growing' },
      orderBy: { rolesDelta12wk: 'desc' },
      take: 15,
      select: { openRolesTotal: true, rolesDelta12wk: true, topFunctionsHiring: true, company: { select: { name: true } } },
    })
    return rows.map((r) => ({
      name: r.company.name,
      openRoles: r.openRolesTotal,
      added12wk: r.rolesDelta12wk,
      topFunctions: Array.isArray(r.topFunctionsHiring) ? (r.topFunctionsHiring as string[]).slice(0, 3) : [],
    }))
  })
}
