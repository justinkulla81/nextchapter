import 'server-only'
import { getRecentNotices } from '@/lib/seo/topic-data'
import { INDUSTRIES } from '@/lib/seo/topics'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { getAnnouncements, hasRecentAnnouncement } from '@/lib/warn/company-announcements'
import { companyWarnFacts } from '@/lib/warn/company-facts'
import { getCompanies, noticeDay } from '@/lib/warn/layoff-pages'
import type { EmployerFacts, IndustryTrend } from '@/lib/layoff-risk/rules'

// The reads behind the layoff risk check: how WARN notices in each industry moved between the two halves of the last year, and a
// small employer lookup over the same notices and announcements the layoff pages use. Both come from data the site already caches.

const HALF_YEAR_MS = 182 * 24 * 60 * 60 * 1000

/** Notices per industry bucket in the last 6 months and the 6 months before, for every industry the site lists. */
export async function getIndustryTrends(now = Date.now()): Promise<IndustryTrend[]> {
  const notices = await getRecentNotices().catch(() => [])
  const by = new Map<string, IndustryTrend>(INDUSTRIES.map((i) => [i.name, { bucket: i.name, last6: 0, prior6: 0 }]))
  for (const n of notices) {
    const t = n.bucket ? by.get(n.bucket) : null
    if (!t) continue
    const age = now - new Date(n.noticeDate).getTime()
    if (age <= HALF_YEAR_MS) t.last6++
    else t.prior6++
  }
  return [...by.values()]
}

const key = (s: string) => normalizeOrgName(s).replace(/[^a-z0-9 ]/g, '').trim()

/** Employers whose name starts with, or contains, what was typed: those with notices, and those with only an announcement. */
export async function lookupEmployers(query: string, limit = 8): Promise<EmployerFacts[]> {
  const q = key(query)
  if (q.length < 2) return []
  const [companies, announcements] = await Promise.all([getCompanies(), getAnnouncements().catch(() => new Map())])
  const out: { facts: EmployerFacts; rank: number }[] = []
  const seen = new Set<string>()

  for (const c of companies.values()) {
    const name = key(c.name)
    if (!name.includes(q)) continue
    seen.add(c.slug)
    const f = companyWarnFacts(c)
    out.push({
      rank: (name.startsWith(q) ? 0 : 1) * 1_000_000 - f.recent,
      facts: {
        name: c.name,
        slug: c.slug,
        recentNotices: f.recent,
        recentMonths: f.recentMonthsWithFilings,
        latest: f.latest ? noticeDay(f.latest) : null,
        announcedRecently: hasRecentAnnouncement(announcements.get(c.slug)),
      },
    })
  }
  for (const a of announcements.values()) {
    if (seen.has(a.slug)) continue
    const name = key(a.name)
    if (!name.includes(q)) continue
    out.push({
      rank: (name.startsWith(q) ? 0 : 1) * 1_000_000 + 500_000,
      facts: { name: a.name, slug: a.slug, recentNotices: 0, recentMonths: 0, latest: null, announcedRecently: hasRecentAnnouncement(a) },
    })
  }
  return out.sort((x, y) => x.rank - y.rank || x.facts.name.localeCompare(y.facts.name)).slice(0, limit).map((o) => o.facts)
}
