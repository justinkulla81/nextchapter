import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { canonical } from '@/lib/seo/canonical'
import { stateName } from '@/lib/seo/states'
import { getFirmListings } from '@/lib/seo/search-firm-pages'
import { FIRM_KIND_LABEL, FIRM_KIND_PLURAL, isFirmKind, type FirmKind } from '@/lib/seo/search-firm-bar'

export const revalidate = 21600
export const metadata: Metadata = {
  title: 'Search firms and recruiters hiring now',
  description: 'Executive search firms, recruiting firms and staffing companies with open searches right now: roles, levels, places and posted pay, from our own job board.',
  ...canonical('/search-firms'),
}

const PAGE_SIZE = 50
const n0 = (n: number) => n.toLocaleString('en-US')
const KINDS: FirmKind[] = ['retained', 'contingent', 'nonprofit_higher_ed', 'staffing', 'outplacement', 'search']

function href(kind: string | null, state: string | null, page: number): string {
  const q = new URLSearchParams()
  if (kind) q.set('segment', kind)
  if (state) q.set('state', state)
  if (page > 1) q.set('page', String(page))
  const s = q.toString()
  return s ? `/search-firms?${s}` : '/search-firms'
}

export default async function SearchFirmsHub({ searchParams }: { searchParams: Promise<{ segment?: string; state?: string; page?: string }> }) {
  const sp = await searchParams
  const kind = isFirmKind(sp.segment) ? sp.segment : null
  const state = sp.state && /^[A-Z]{2}$/.test(sp.state) ? sp.state : null
  const page = Math.max(1, Math.min(200, Number(sp.page) || 1))
  const all = await getFirmListings()
  const stateCounts = new Map<string, number>()
  for (const f of all) for (const st of f.states) stateCounts.set(st, (stateCounts.get(st) ?? 0) + 1)
  const states = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  const kindCounts = new Map<FirmKind, number>()
  for (const f of all) kindCounts.set(f.kind, (kindCounts.get(f.kind) ?? 0) + 1)
  const rows = all.filter((f) => (!kind || f.kind === kind) && (!state || f.states.includes(state)))
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-sm ${active ? 'border-navy bg-navy text-white' : 'border-border bg-white text-foreground hover:bg-muted'}`

  return (
    <SeoPage
      look="audience"
      trail={[{ name: 'Search firms', path: '/search-firms' }]}
      h1="Search firms and recruiters hiring now"
      lede={<>{n0(all.length)} search firms, recruiting firms and staffing companies with open searches on our board. Each page shows what the firm is recruiting for, its specialties, where, and how long its searches stay open.</>}
    >
      <section aria-labelledby="filters" className="mt-8">
        <h2 id="filters" className="sr-only">Filters</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={href(null, state, 1)} className={chip(!kind)}>All types</Link>
          {KINDS.filter((k) => kindCounts.get(k)).map((k) => <Link key={k} href={href(k, state, 1)} className={chip(kind === k)}>{FIRM_KIND_PLURAL[k]} ({n0(kindCounts.get(k)!)})</Link>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={href(kind, null, 1)} className={chip(!state)}>All states</Link>
          {states.map(([st]) => <Link key={st} href={href(kind, st, 1)} className={chip(state === st)}>{stateName(st) ?? st}</Link>)}
        </div>
      </section>

      <section aria-labelledby="firms" className="mt-10">
        <h2 id="firms" className={H2}>{n0(rows.length)} {rows.length === 1 ? 'firm' : 'firms'}</h2>
        {shown.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No firms match. <Link href="/search-firms" className={LINK}>Clear the filters</Link>.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {shown.map((f) => (
              <li key={f.orgId} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                <span><Link href={`/search-firms/${f.slug}`} className={`${LINK} font-medium`}>{f.name}</Link> <span className="text-xs text-muted-foreground">{FIRM_KIND_LABEL[f.kind]}</span></span>
                <span className="text-xs text-muted-foreground">{[`${n0(f.publicRoles)} open`, f.topFunction, f.states.slice(0, 3).map((s) => stateName(s) ?? s).join(', ')].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="mt-6 flex items-center gap-4 text-sm">
            {page > 1 && <Link href={href(kind, state, page - 1)} className={LINK} rel="prev">Previous</Link>}
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            {page < pages && <Link href={href(kind, state, page + 1)} className={LINK} rel="next">Next</Link>}
          </nav>
        )}
      </section>

      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        Only searches with a public listing are counted; searches a firm runs in confidence never appear. Recruiter? <Link href="/recruiters" className={LINK}>Search candidates who chose to be found</Link>.
      </p>
    </SeoPage>
  )
}
