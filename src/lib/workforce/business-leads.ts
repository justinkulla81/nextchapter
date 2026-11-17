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

// Unquoted, the way such headlines read (tested 2026-11-17: quoted phrases returned almost nothing).
const QUERIES = ['opens new headquarters', 'company expansion new jobs', 'announces expansion jobs', 'relocating headquarters', 'moving headquarters to', 'to open office hire', 'selects site new facility jobs']
// A lead names growth or a move; a story that only cuts or closes is a layoff, not a lead.
const GROWTH = /\b(opens?|opening|expan\w*|headquarters|hq|relocat\w*|mov(e|es|ing)|new (office|facility|plant|campus|location)|jobs|hir(e|es|ing)|invest\w*|selects?)\b/i
const CUT = /\b(layoffs?|lay(s)? off|cuts?|cutting|shut(s|ting)? down|bankrupt\w*|lawsuit|sued)\b/i
const CLOSE_ONLY = /\bclos(e|es|ing|ure)\b/i
const MOVE = /\b(mov(e|es|ing)|relocat\w*|headquarters|hq)\b/i
export function isExpansionLead(title: string): boolean {
  if (!GROWTH.test(title) || CUT.test(title)) return false
  return !CLOSE_ONLY.test(title) || MOVE.test(title)
}

export async function expansionNews(): Promise<ExpansionStory[]> {
  return sharedLoad('business-expansion-news-v2', 12 * 3600, async () => {
    const seen = new Set<string>()
    const out: ExpansionStory[] = []
    for (const q of QUERIES) {
      const found = await searchGoogleNews(q, { days: 14 }).catch(() => [])
      for (const a of found) {
        const key = a.title.toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 80)
        if (seen.has(key) || !isExpansionLead(a.title)) continue
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
