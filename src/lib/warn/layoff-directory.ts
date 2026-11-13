import { TWELVE_MONTHS_MS, type CompanySummary } from '@/lib/warn/layoff-pages'
import { hasRecentAnnouncement, type CompanyAnnouncements } from '@/lib/warn/company-announcements'

// Every employer whose layoff page is indexed: a filing in the last 12 months, or a recent announcement with no filing yet. The
// same set /layoffs/sitemap.xml lists, so the A–Z page links every layoff page Google is asked to read, and a new layoff joins
// it the moment its notice or announcement is recorded.

export interface DirectoryEntry {
  slug: string
  name: string
  latest: Date
  states: string[]
  /** Workers the filings name, summed; null when no filing gives a number. */
  workers: number | null
}

export function layoffDirectory(
  companies: Map<string, CompanySummary>,
  announcements: Map<string, CompanyAnnouncements>,
  now = Date.now(),
): DirectoryEntry[] {
  const cutoff = now - TWELVE_MONTHS_MS
  const out = new Map<string, DirectoryEntry>()
  for (const c of companies.values()) {
    if (c.latest.getTime() < cutoff) continue
    const named = c.notices.filter((n) => n.workers != null)
    out.set(c.slug, {
      slug: c.slug,
      name: c.name,
      latest: c.latest,
      states: [...c.states].sort(),
      workers: named.length ? named.reduce((t, n) => t + (n.workers ?? 0), 0) : null,
    })
  }
  for (const a of announcements.values()) {
    if (out.has(a.slug) || !hasRecentAnnouncement(a, now)) continue
    const named = a.items.filter((i) => i.workers != null)
    out.set(a.slug, { slug: a.slug, name: a.name, latest: a.latest, states: [], workers: named.length ? Math.max(...named.map((i) => i.workers ?? 0)) : null })
  }
  return [...out.values()].sort((x, y) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' }))
}

/** The letter an employer files under: A–Z, or "#" for a name that starts with a digit or symbol. */
export function directoryLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase()
  return first >= 'A' && first <= 'Z' ? first : '#'
}
