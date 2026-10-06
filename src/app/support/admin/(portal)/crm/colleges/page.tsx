import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { LinkButtonGroup } from '@/components/admin/LinkButtonGroup'
import { PageSizePicker, readPageSize } from '@/components/admin/PageSizePicker'
import { CollegesViewTracker } from '@/components/admin/WorkforceBoardsViewTracker'
import { COLLEGE_SECTORS, COLLEGE_SIZES, boardCountyKeys } from '@/lib/workforce/board-area'
import { COLLEGE_ROLES, type CollegeRole } from '@/lib/workforce/college-pages'
import { INTEREST_THEMES, isPersonalEmail, type InterestTheme, type ScoreParts } from '@/lib/workforce/college-score'

export const maxDuration = 60

const BASE = '/support/admin/crm/colleges'
const SORTS = [
  { key: 'rank', label: 'Rank' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'interest', label: 'Interest' },
  { key: 'name', label: 'Name' },
] as const
const TIERS = [
  { key: 'AB', label: 'A and B' },
  { key: 'A', label: 'A' },
  { key: 'B', label: 'B' },
  { key: 'all', label: 'All' },
] as const
const CONTACT_FILTERS = [
  { key: '', label: 'Any' },
  { key: 'leader', label: 'Named leader' },
  { key: 'personal', label: 'Leader with own email' },
] as const

/** Carnegie 2021 basic classes, shortened. */
function carnegieLabel(c: number | null): string | null {
  if (c == null) return null
  if (c === 15) return 'R1 research'
  if (c === 16) return 'R2 research'
  if (c === 17) return 'Doctoral/professional'
  if (c >= 18 && c <= 20) return "Master's"
  if (c === 21 || c === 22) return 'Baccalaureate'
  if (c === 23) return 'Baccalaureate/associate'
  if (c <= 14) return "Associate's"
  if (c === 29) return 'Business school'
  if (c === 27 || c === 28) return 'Engineering/technology'
  return 'Special focus'
}

export default async function CollegesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const state = sp.state ?? ''
  const tier = TIERS.some((t) => t.key === sp.tier) ? sp.tier! : 'AB'
  const sort = SORTS.some((s) => s.key === sp.sort) ? sp.sort! : 'rank'
  const contactsFilter = CONTACT_FILTERS.some((c) => c.key === sp.contacts) ? sp.contacts! : ''
  const theme = sp.theme && sp.theme in INTEREST_THEMES ? (sp.theme as InterestTheme) : ''
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const perPage = readPageSize(sp.per)

  const where: Prisma.LocalCollegeWhereInput = {
    rank: { not: null },
    ...(tier === 'AB' ? { tier: { in: ['A', 'B'] } } : tier === 'all' ? {} : { tier }),
    ...(state ? { state } : {}),
    ...(theme ? { interestSignals: { has: theme } } : {}),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { chiefName: { contains: q, mode: 'insensitive' } },
      ],
    } : {}),
  }
  // Contact filters and the contact/interest sorts need every match in hand;
  // there are at most a few thousand colleges, so that is cheap.
  const [all, states] = await Promise.all([
    prisma.localCollege.findMany({ where, orderBy: { rank: 'asc' } }),
    prisma.localCollege.groupBy({ by: ['state'], orderBy: { state: 'asc' } }),
  ])
  const contacts = await prisma.collegeContact.findMany({ where: { collegeId: { in: all.map((c) => c.id) } } })
  const byCollege = new Map<string, typeof contacts>()
  for (const c of contacts) byCollege.set(c.collegeId, [...(byCollege.get(c.collegeId) ?? []), c])
  const leaders = (id: string) => (byCollege.get(id) ?? []).filter((c) => c.name)
  const personal = (id: string) => leaders(id).filter((c) => isPersonalEmail(c.email, c.name))

  let rows = all.filter((c) =>
    contactsFilter === 'leader' ? leaders(c.id).length > 0
    : contactsFilter === 'personal' ? personal(c.id).length > 0
    : true)
  const parts = (c: (typeof all)[number]) => (c.scoreParts ?? {}) as unknown as ScoreParts
  if (sort === 'contacts') rows = [...rows].sort((a, b) => (parts(b).contacts ?? 0) - (parts(a).contacts ?? 0) || (a.rank ?? 0) - (b.rank ?? 0))
  if (sort === 'interest') rows = [...rows].sort((a, b) => (parts(b).interest ?? 0) - (parts(a).interest ?? 0) || (a.rank ?? 0) - (b.rank ?? 0))
  if (sort === 'name') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name))

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageRows = rows.slice((page - 1) * perPage, page * perPage)

  // The board for each college on the page, for the link to its area.
  const pageStates = [...new Set(pageRows.map((c) => c.state))]
  const boards = await prisma.workforceBoard.findMany({
    where: { state: { in: pageStates } },
    select: { id: true, name: true, state: true, counties: true, placeCounties: true, statewide: true },
  })
  const boardFor = (c: (typeof all)[number]) => {
    const inState = boards.filter((b) => b.state === c.state)
    const local = inState.filter((b) => !b.statewide)
    return (local.length ? local : inState).find((b) => {
      const keys = boardCountyKeys(b)
      return keys === 'all' || (!!c.countyKey && keys.includes(c.countyKey))
    })
  }

  const params: Record<string, string> = { q, state, tier, sort, contacts: contactsFilter, theme, per: String(perPage) }
  const href = (over: Record<string, string>) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...params, page: '1', ...over })) if (v) qs.set(k, v)
    return `${BASE}?${qs}`
  }
  const roleOrder = Object.keys(COLLEGE_ROLES) as CollegeRole[]

  return (
    <div className="space-y-4">
      <CollegesViewTracker q={q} state={state} tier={tier} sort={sort} contacts={contactsFilter} theme={theme} results={total} />
      <header>
        <h1 className="text-2xl font-semibold">Colleges</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every degree-granting college, ranked as a pilot partner for mid-career alumni facing layoffs and AI. The score
          (out of 100) adds four parts: contacts (30) — a named leader with their own email for career services, alumni,
          development and executive education; fit (30) — four-year colleges whose alumni are white-collar professionals,
          plus layoffs filed nearby; size (20) — 5,000–20,000 students is best, very selective schools lose most of it
          because they run their own alumni programs; interest (20) — what the college&apos;s own pages say about AI,
          reskilling, alumni career help, lifelong learning and executive education. Community colleges stay in tier C.
          Re-ranked weekly.
        </p>
      </header>

      <AdminFilterBar
        basePath={BASE}
        searchValue={q}
        searchPlaceholder="Search college, city or president…"
        filters={[
          { key: 'state', label: 'State', value: state, options: [{ value: '', label: 'Any state' }, ...states.map((s) => ({ value: s.state, label: s.state }))] },
          {
            key: 'theme', label: 'Interest', value: theme,
            options: [{ value: '', label: 'Any interest' }, ...(Object.keys(INTEREST_THEMES) as InterestTheme[]).map((t) => ({ value: t, label: INTEREST_THEMES[t].label }))],
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LinkButtonGroup label="Tier" items={TIERS.map((t) => ({ label: t.label, active: t.key === tier, href: href({ tier: t.key }) }))} />
        <LinkButtonGroup label="Contacts" items={CONTACT_FILTERS.map((c) => ({ label: c.label, active: c.key === contactsFilter, href: href({ contacts: c.key }) }))} />
        <LinkButtonGroup label="Sort by" items={SORTS.map((s) => ({ label: s.label, active: s.key === sort, href: href({ sort: s.key }) }))} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} colleges</p>
        <PageSizePicker basePath={BASE} params={params} current={perPage} label="colleges" />
      </div>

      {pageRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No colleges match.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try tier &quot;All&quot;, another state, or a shorter search.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-2 py-1.5 text-right font-medium">#</th>
                <th className="px-3 py-1.5 font-medium">College</th>
                <th className="px-2 py-1.5 text-right font-medium" title="Contacts / fit / size / interest">Score</th>
                <th className="px-2 py-1.5 font-medium">Interest</th>
                <th className="px-2 py-1.5 font-medium">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => {
                const p = parts(c)
                const board = boardFor(c)
                const list = (byCollege.get(c.id) ?? []).sort((a, b) => roleOrder.indexOf(a.role as CollegeRole) - roleOrder.indexOf(b.role as CollegeRole))
                return (
                  <tr key={c.id} className="border-b border-border align-top last:border-0">
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{c.rank}</td>
                    <td className="max-w-sm px-3 py-2">
                      <p className="font-medium">
                        {c.website ? <a href={c.website} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">{c.name}</a> : c.name}
                        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">Tier {c.tier}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[c.city && `${c.city}, ${c.state}`, carnegieLabel(c.carnegie) ?? (c.sector ? COLLEGE_SECTORS[c.sector] : null),
                          c.size ? `${COLLEGE_SIZES[c.size]} students` : null,
                          c.admitRate != null ? `${Math.round(c.admitRate * 100)}% admitted` : null].filter(Boolean).join(' · ')}
                      </p>
                      {c.chiefName && <p className="text-xs text-muted-foreground">{c.chiefName}{c.chiefTitle ? `, ${c.chiefTitle}` : ''}{c.phone ? ` · ${c.phone}` : ''}</p>}
                      {board && (
                        <p className="text-xs">
                          <Link href={`/support/admin/crm/workforce-boards/${encodeURIComponent(board.id)}`} className="text-primary hover:underline">{board.name}</Link>
                        </p>
                      )}
                      {p.notes?.length > 0 && <p className="text-xs text-muted-foreground">{p.notes.join(' · ')}</p>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <span className="font-semibold tabular-nums">{c.score?.toFixed(0)}</span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground" title="Contacts / fit / size / interest">
                        {[p.contacts, p.fit, p.size, p.interest].map((v) => Math.round(v ?? 0)).join(' / ')}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex max-w-48 flex-wrap gap-1">
                        {c.interestSignals.length === 0 && <span className="text-xs text-muted-foreground">{c.contactsCheckedAt ? 'None found' : 'Not read'}</span>}
                        {c.interestSignals.map((t) => (
                          <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{INTEREST_THEMES[t as InterestTheme]?.label ?? t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="min-w-80 px-2 py-2 text-xs">
                      {list.length === 0 ? (
                        <span className="text-muted-foreground">{c.contactsCheckedAt ? (c.contactsPagesRead ? 'None named on its site' : 'Site could not be read') : 'Not read'}</span>
                      ) : (
                        <ul className="space-y-1">
                          {list.map((k) => (
                            <li key={k.id}>
                              <span className="text-muted-foreground">{COLLEGE_ROLES[k.role as CollegeRole]?.label ?? k.role}: </span>
                              {k.name ? (
                                k.crmPersonId ? (
                                  <Link href={`/support/admin/crm/people/${k.crmPersonId}`} className="text-primary hover:underline" title="In the CRM">{k.name}</Link>
                                ) : (
                                  <a href={k.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">{k.name}</a>
                                )
                              ) : (
                                <a href={k.sourceUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline">office</a>
                              )}
                              {k.title && <span className="text-muted-foreground">, {k.title}</span>}
                              {k.email && <> · <a href={`mailto:${k.email}`} className="hover:underline">{k.email}</a></>}
                              {k.phone && <> · <span className="whitespace-nowrap">{k.phone}</span></>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
            {page < totalPages && <Link href={href({ page: String(page + 1) })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
          </span>
        </nav>
      )}
    </div>
  )
}
