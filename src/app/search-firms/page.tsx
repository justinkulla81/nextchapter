import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { stateName } from '@/lib/seo/states'
import { getFirmListings, isGeneralFirm } from '@/lib/seo/search-firm-pages'
import { FIRM_KIND_LABEL, FIRM_KIND_PLURAL, SENIORITY_BANDS, isFirmKind, type FirmKind } from '@/lib/seo/search-firm-bar'
import { ExpressInterestButton } from '@/components/search-firms/ExpressInterestButton'

export const revalidate = 86400 // 24 hours: was 6 hours; every regeneration is a billed ISR write
export const metadata: Metadata = {
  title: 'Search firms and recruiters hiring now',
  description: 'Executive search firms, recruiting firms and staffing companies with open searches right now: roles, levels, places and posted pay, from our own job board.',
  ...canonical('/search-firms'),
}

const PAGE_SIZE = 50
const n0 = (n: number) => n.toLocaleString('en-US')
const KINDS: FirmKind[] = ['retained', 'contingent', 'nonprofit_higher_ed', 'staffing', 'outplacement', 'search']
const SORTS = [{ key: 'searches', label: 'Live searches' }, { key: 'name', label: 'Name' }, { key: 'new', label: 'Newest' }] as const
type SortKey = (typeof SORTS)[number]['key']

type Q = { segment?: string; state?: string; industry?: string; fn?: string; level?: string; sort?: string; page?: string }

function href(q: Q, page = 1): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v && k !== 'page') p.set(k, v)
  if (page > 1) p.set('page', String(page))
  const s = p.toString()
  return s ? `/search-firms?${s}` : '/search-firms'
}

const SELECT = 'mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-sm'

export default async function SearchFirmsHub({ searchParams }: { searchParams: Promise<Q> }) {
  const sp = await searchParams
  const kind = isFirmKind(sp.segment) ? sp.segment : null
  const state = sp.state && /^[A-Z]{2}$/.test(sp.state) ? sp.state : null
  const level = (SENIORITY_BANDS as readonly string[]).includes(sp.level ?? '') ? sp.level! : null
  const sort: SortKey = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as SortKey) : 'searches'
  const page = Math.max(1, Math.min(200, Number(sp.page) || 1))
  const all = await getFirmListings()

  const count = (pick: (f: (typeof all)[number]) => string[]) => {
    const m = new Map<string, number>()
    for (const f of all) for (const v of pick(f)) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }
  const industries = count((f) => f.industries ?? [])
  const functions = count((f) => f.functions ?? [])
  const states = count((f) => f.states).slice(0, 50)
  const kinds = count((f) => [f.kind])
  const industry = industries.some(([v]) => v === sp.industry) ? sp.industry! : null
  const fn = functions.some(([v]) => v === sp.fn) ? sp.fn! : null
  const current: Q = { segment: kind ?? undefined, state: state ?? undefined, industry: industry ?? undefined, fn: fn ?? undefined, level: level ?? undefined, sort: sort === 'searches' ? undefined : sort }

  const rows = all
    .filter((f) => (!kind || f.kind === kind) && (!state || f.states.includes(state)) && (!industry || (f.industries ?? []).includes(industry)) && (!fn || (f.functions ?? []).includes(fn)) && (!level || (f.seniorities ?? []).includes(level)))
    .sort((a, b) => {
      // General firms (no clear specialty) never sit ahead of a specialist, whatever the sort.
      const ga = isGeneralFirm({ industries: a.industries ?? [], functions: a.functions ?? [] })
      const gb = isGeneralFirm({ industries: b.industries ?? [], functions: b.functions ?? [] })
      if (ga !== gb) return ga ? 1 : -1
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'new') return b.lastVerifiedAt.localeCompare(a.lastVerifiedAt)
      return b.publicRoles - a.publicRoles || a.name.localeCompare(b.name)
    })
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const chip = (active: boolean) => `rounded-md border px-3 py-1.5 text-sm ${active ? 'border-navy bg-navy text-white' : 'border-border bg-white text-foreground hover:bg-muted'}`

  return (
    <SeoPage
      look="audience"
      trail={[{ name: 'Search firms', path: '/search-firms' }]}
      h1="Search firms and recruiters hiring now"
      lede={<>{n0(all.length)} search firms, recruiting firms and staffing companies with open searches on our board. Filter by what a firm recruits for, then express interest in the ones you want. Firms with no clear specialty are listed as General, after the specialists.</>}
    >
      <section aria-labelledby="filters" className="mt-8">
        <h2 id="filters" className="sr-only">Filters</h2>
        <form method="get" action="/search-firms" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Industry
            <select name="industry" defaultValue={industry ?? ''} className={SELECT}><option value="">Any industry</option>{industries.map(([v]) => <option key={v} value={v}>{v}</option>)}</select>
          </label>
          <label className="text-sm font-medium">Function
            <select name="fn" defaultValue={fn ?? ''} className={SELECT}><option value="">Any function</option>{functions.map(([v]) => <option key={v} value={v}>{v}</option>)}</select>
          </label>
          <label className="text-sm font-medium">Seniority
            <select name="level" defaultValue={level ?? ''} className={SELECT}><option value="">Any level</option>{SENIORITY_BANDS.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          </label>
          <label className="text-sm font-medium">State
            <select name="state" defaultValue={state ?? ''} className={SELECT}><option value="">Any state</option>{states.map(([st]) => <option key={st} value={st}>{stateName(st) ?? st}</option>)}</select>
          </label>
          <label className="text-sm font-medium">Type of firm
            <select name="segment" defaultValue={kind ?? ''} className={SELECT}><option value="">Any type</option>{KINDS.filter((k) => kinds.some(([v]) => v === k)).map((k) => <option key={k} value={k}>{FIRM_KIND_PLURAL[k]}</option>)}</select>
          </label>
          <input type="hidden" name="sort" value={sort} />
          <div className="flex items-end gap-3">
            <button type="submit" className="rounded-md border border-navy bg-navy px-4 py-2 text-sm font-semibold text-white">Show firms</button>
            {(kind || state || industry || fn || level) && <Link href={href({ sort: current.sort })} className={LINK}>Clear filters</Link>}
          </div>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Sort firms">
          <span className="text-sm text-muted-foreground">Sort by</span>
          {SORTS.map((s) => <Link key={s.key} href={href({ ...current, sort: s.key === 'searches' ? undefined : s.key })} aria-current={sort === s.key ? 'true' : undefined} className={chip(sort === s.key)}>{s.label}</Link>)}
        </div>
      </section>

      <section aria-labelledby="firms" className="mt-10">
        <h2 id="firms" className={H2}>{n0(rows.length)} {rows.length === 1 ? 'firm' : 'firms'}</h2>
        {shown.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No firms match these filters. <Link href="/search-firms" className={LINK}>Clear the filters</Link> to see more.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {shown.map((f) => {
              const tags = [...(f.industries ?? []), ...(f.functions ?? []), ...(f.seniorities ?? []), ...f.states.slice(0, 3)]
              const general = isGeneralFirm({ industries: f.industries ?? [], functions: f.functions ?? [] })
              return (
                <li key={f.orgId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link href={`/search-firms/${f.slug}`} className={`${LINK} font-medium`}>{f.name}</Link>{' '}
                    <span className="text-xs text-muted-foreground">{FIRM_KIND_LABEL[f.kind]} · {n0(f.publicRoles)} live searches</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {general ? <span className="rounded border border-border px-2 py-0.5 text-xs italic text-muted-foreground">General</span> : tags.map((t) => <span key={t} className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs">{stateName(t) ?? t}</span>)}
                    </div>
                  </div>
                  <ExpressInterestButton orgId={f.orgId} firmName={f.name} source="directory" />
                </li>
              )
            })}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="mt-6 flex items-center gap-4 text-sm">
            {page > 1 && <Link href={href(current, page - 1)} className={LINK} rel="prev">Previous</Link>}
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            {page < pages && <Link href={href(current, page + 1)} className={LINK} rel="next">Next</Link>}
          </nav>
        )}
      </section>

      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        Only searches with a public listing are counted; searches a firm runs in confidence never appear. Recruiter? <Link href="/recruiters" className={LINK}>Search candidates who chose to be found</Link>.
      </p>
    </SeoPage>
  )
}
