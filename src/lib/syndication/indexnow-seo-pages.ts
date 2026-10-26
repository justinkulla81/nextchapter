import 'server-only'
import { heavy } from '@/lib/db/heavy'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/seo/facts'
import { EMPLOYER_SITEMAP_SHARD_SIZE, countEmployerPages, employersInShard } from '@/lib/seo/employer-pages'
import { employerSlug } from '@/lib/seo/employer-slug'
import { nonprofitsForSitemap } from '@/lib/seo/nonprofit-pages'
import { planOrgPageUpdates } from '@/lib/seo/org-page-rules'
import { stateSlug } from '@/lib/seo/states'
import { boardSlugs } from '@/lib/seo/workforce-pages'
import { visibleBoards } from '@/lib/workforce/board-area'
import { STATE_NAMES } from '@/lib/workforce/places'
import { isNetworkCompany } from '@/lib/network/eligibility'
import { getCompanies, getStateSummaries } from '@/lib/warn/layoff-pages'
import { getAnnouncements, hasRecentAnnouncement } from '@/lib/warn/company-announcements'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import { chunk, INDEXNOW_BATCH, INDEXNOW_ENDPOINT, INDEXNOW_NEW_PER_RUN, indexNowBody } from '@/lib/syndication/syndication'

// Daily IndexNow for the pages the job and organization crons do not cover: employer pages, nonprofit pages, the
// workforce, rapid-response and higher-education state pages, and the layoff pages. It sends a page the first time it
// qualifies, and (for the layoff pages) again when a newer notice is filed. Same key, endpoint and state bucket as
// indexnow-org-pages. A rejected batch stops the run; the rest goes next time.

const STATE_PATH = 'indexnow/seo-pages.json.gz'
interface State { v: 1; pages: Record<string, string> }
interface Page { path: string; lastModified: string }

// A page that is announced once and not again unless its stamp changes. Employer, nonprofit and directory pages change
// often but not in ways worth a resubmission, so they carry a fixed stamp.
const ONCE = '1'
const day = (d: Date) => d.toISOString().slice(0, 10)

async function currentPages(): Promise<Page[]> {
  const out: Page[] = [
    { path: '/workforce-boards', lastModified: ONCE }, { path: '/rapid-response', lastModified: ONCE }, { path: '/economic-development', lastModified: ONCE },
    { path: '/tools/warn-act-checker', lastModified: ONCE }, { path: '/tools/severance-calculator', lastModified: ONCE },
  ]

  // Workforce board, rapid-response and higher-education state pages, from one read of the boards and the college states.
  const [boards, collegeStates] = await heavy(() => Promise.all([
    prisma.workforceBoard.findMany({ select: { id: true, state: true, name: true, statewide: true }, orderBy: { name: 'asc' } }),
    prisma.localCollege.groupBy({ by: ['state'], where: { sector: { in: [1, 2, 4, 5] } }, _count: { _all: true } }),
  ]))
  const hasColleges = new Set(collegeStates.map((c) => c.state))
  const byState = new Map<string, typeof boards>()
  for (const b of boards) byState.set(b.state, [...(byState.get(b.state) ?? []), b])
  for (const [state, all] of byState) {
    if (!(state in STATE_NAMES)) continue
    const slug = stateSlug(state)
    out.push({ path: `/workforce-boards/${slug}`, lastModified: ONCE }, { path: `/rapid-response/${slug}`, lastModified: ONCE })
    if (hasColleges.has(state)) out.push({ path: `/higher-education/${slug}`, lastModified: ONCE })
    const shown = visibleBoards(all)
    const slugs = boardSlugs(shown)
    for (const b of shown) out.push({ path: `/workforce-boards/${slug}/${slugs.get(b.id)}`, lastModified: ONCE })
  }

  // Nonprofit pages and their state pages.
  const nonprofits = await heavy(() => nonprofitsForSitemap())
  const nonprofitStates = new Set<string>()
  for (const n of nonprofits) {
    if (!(n.state in STATE_NAMES)) continue
    nonprofitStates.add(n.state)
    out.push({ path: `/nonprofits/${stateSlug(n.state)}/${n.slug}`, lastModified: ONCE })
  }
  for (const s of nonprofitStates) out.push({ path: `/nonprofits/${stateSlug(s)}`, lastModified: ONCE })

  // Employer pages: the same set as the employer sitemap files.
  const shards = Math.ceil((await heavy(() => countEmployerPages())) / EMPLOYER_SITEMAP_SHARD_SIZE)
  for (let i = 0; i < shards; i++) {
    for (const e of await heavy(() => employersInShard(i))) out.push({ path: `/employers/${employerSlug(e.canonical, e.id)}`, lastModified: ONCE })
  }

  // Layoff pages: announced again when a newer notice is filed.
  const [companies, states, announcements] = await Promise.all([getCompanies(), getStateSummaries(), getAnnouncements().catch(() => new Map())])
  for (const s of states) out.push({ path: `/layoffs/${stateSlug(s.state)}`, lastModified: day(s.latest) })
  for (const c of companies.values()) {
    out.push({ path: `/layoffs/company/${c.slug}`, lastModified: day(c.latest) })
    if (isNetworkCompany(c)) out.push({ path: `/network/company/${c.slug}`, lastModified: day(c.latest) })
  }
  // A buyout or reported layoff is announced the day it is added, and again when a newer one lands.
  for (const a of announcements.values()) {
    if (!hasRecentAnnouncement(a)) continue
    const existing = out.findIndex((o) => o.path === `/layoffs/company/${a.slug}`)
    if (existing >= 0) out.splice(existing, 1)
    out.push({ path: `/layoffs/company/${a.slug}`, lastModified: day(companies.get(a.slug) && companies.get(a.slug)!.latest > a.latest ? companies.get(a.slug)!.latest : a.latest) })
  }
  return out
}

export async function runSeoPagesIndexNow(opts: { dryRun?: boolean } = {}) {
  const [current, saved] = await Promise.all([currentPages(), readJsonGz<State>(STATE_BUCKET, STATE_PATH)])
  const announced = { ...(saved?.pages ?? {}) }
  const stamp = new Map(current.map((p) => [p.path, p.lastModified]))
  const due = planOrgPageUpdates(current, announced).slice(0, INDEXNOW_NEW_PER_RUN)
  const result = { dryRun: !!opts.dryRun, pages: current.length, due: due.length, sent: 0, stoppedEarly: null as string | null, sample: due.slice(0, 3).map((p) => `${SITE_URL}${p}`) }
  if (opts.dryRun) return result
  for (const batch of chunk(due, INDEXNOW_BATCH)) {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowBody(batch.map((p) => `${SITE_URL}${p}`))),
      signal: AbortSignal.timeout(60_000),
    })
    if (res.status !== 200 && res.status !== 202) {
      result.stoppedEarly = `IndexNow answered ${res.status}: ${(await res.text()).slice(0, 300)}`
      break
    }
    for (const p of batch) announced[p] = stamp.get(p)!
    result.sent += batch.length
    await writeJsonGz(STATE_BUCKET, STATE_PATH, { v: 1, pages: announced } satisfies State)
  }
  return result
}
