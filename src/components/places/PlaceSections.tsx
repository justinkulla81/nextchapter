import { StateFilingLink } from '@/components/benefits/StateFilingGuide'
import Link from 'next/link'
import { H2, LINK, Stat } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { COLLEGE_SECTORS, COLLEGE_SIZES } from '@/lib/workforce/board-area'
import { periodLabel } from '@/lib/seo/workforce-pages'
import type { HqEmployer, PlaceCenter, PlaceCollege, PlaceEmployer, PlaceJob } from '@/lib/places/places'
import type { PublicBoard } from '@/lib/seo/workforce-pages'

export const usd = (n: number) => `$${n.toLocaleString('en-US')}`
export const pct1 = (n: number) => `${n.toFixed(1)}%`

type Labor = {
  population: number | null; laborForce: number | null; unemploymentRate: number | null; unemploymentRatePrior: number | null
  asOf: string | null; medianHouseholdIncome: number | null; whiteCollarShare: number | null
}

/** Population, unemployment, income and white-collar share. Nothing is shown for a figure we don't have. */
export function EconomySection({ id, title, labor, scope }: { id: string; title: string; labor: Labor; scope: string }) {
  const stats = [
    labor.unemploymentRate != null && (
      <Stat key="u" value={pct1(labor.unemploymentRate)} label={`unemployment${labor.asOf ? `, ${periodLabel(labor.asOf)}` : ''}`}
        note={labor.unemploymentRatePrior != null ? `${pct1(labor.unemploymentRatePrior)} the month before` : undefined} />
    ),
    labor.laborForce != null && <Stat key="l" value={labor.laborForce.toLocaleString()} label="in the labor force" note="Source: BLS Local Area Unemployment Statistics" />,
    labor.population != null && <Stat key="p" value={labor.population.toLocaleString()} label={`people in ${scope}`} note="Source: U.S. Census Bureau" />,
    labor.medianHouseholdIncome != null && <Stat key="i" value={usd(labor.medianHouseholdIncome)} label="median household income" note="Source: Census ACS" />,
    labor.whiteCollarShare != null && <Stat key="w" value={`${Math.round(labor.whiteCollarShare * 100)}%`} label="of workers in white-collar occupations" note="Management, business, financial and professional; Census ACS" />,
  ].filter(Boolean)
  if (stats.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className={H2}>{title}</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stats}</ul>
    </section>
  )
}

export function EmployerList({ id, title, intro, items }: { id: string; title: string; intro?: string; items: PlaceEmployer[] }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>{title}</h2>
      {intro && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((e) => (
          <li key={e.name} className="flex items-baseline justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm">
            {e.href ? <Link href={e.href} className={LINK}>{e.name}</Link> : <span className="font-medium text-navy">{e.name}</span>}
            <span className="shrink-0 tabular-nums text-muted-foreground">{e.openRoles.toLocaleString()} open {e.openRoles === 1 ? 'role' : 'roles'}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function HeadquarteredList({ id, title, intro, items }: { id: string; title: string; intro?: string; items: HqEmployer[] }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>{title}</h2>
      {intro && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((e) => (
          <li key={e.name} className="flex items-baseline justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm">
            {e.href ? <Link href={e.href} className={LINK}>{e.name}</Link> : <span className="font-medium text-navy">{e.name}</span>}
            <span className="shrink-0 text-xs text-muted-foreground">{e.size}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Employee counts with a year are published figures (Wikidata). Other sizes are estimates from our company directory, not payroll counts.</p>
    </section>
  )
}

export function JobList({ id, title, jobs, searchHref, searchLabel, event, properties }: {
  id: string; title: string; jobs: PlaceJob[]; searchHref: string; searchLabel: string; event: string; properties: Record<string, unknown>
}) {
  if (jobs.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>{title}</h2>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
        {jobs.map((j) => (
          <li key={j.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
            <Link href={`/jobs/${j.id}`} className={LINK}>{j.title}</Link>
            <span className="text-muted-foreground">{j.company}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        <TrackedLink href={searchHref} event={event} properties={properties} className={LINK}>{searchLabel}</TrackedLink>
      </p>
    </section>
  )
}

export function CollegeTable({ id, title, colleges, showCity = true, more }: { id: string; title: string; colleges: PlaceCollege[]; showCity?: boolean; more?: { href: string; label: string } }) {
  if (colleges.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>{title}</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="p-3">College</th>
              {showCity && <th scope="col" className="p-3">City</th>}
              <th scope="col" className="p-3">Type</th>
              <th scope="col" className="p-3">Students</th>
            </tr>
          </thead>
          <tbody>
            {colleges.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <th scope="row" className="p-3 font-medium text-navy">{c.name}</th>
                {showCity && <td className="p-3">{c.city ?? ''}</td>}
                <td className="p-3">{c.sector ? COLLEGE_SECTORS[c.sector] : ''}</td>
                <td className="p-3">{c.size ? COLLEGE_SIZES[c.size] : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more && <p className="mt-3 text-sm"><Link href={more.href} className={LINK}>{more.label}</Link></p>}
    </section>
  )
}

/** Workforce boards and American Job Centers serving a place. */
export function WorkforceSection({ id, state, stateSlugValue, boards, centers, scope }: {
  id: string; state: string; stateSlugValue: string; boards: PublicBoard[]; centers: PlaceCenter[]; scope: string
}) {
  if (boards.length === 0 && centers.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>Workforce development and job centers</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        The public workforce board and American Job Centers serving {scope}. They offer free help with job search, training and filing for benefits.
      </p>
      <StateFilingLink name={state} slug={stateSlugValue} className="mt-3" />
      {boards.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {boards.map((b) => (
            <li key={b.id} className="rounded-xl border border-border bg-white p-4 text-sm">
              <Link href={`/workforce-boards/${stateSlugValue}/${b.slug}`} className={`${LINK} font-medium`}>{b.name}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{b.statewide ? `Serves all of ${state}` : b.serviceArea ?? 'Local workforce development board'}</p>
            </li>
          ))}
        </ul>
      )}
      {centers.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {centers.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-white p-4 text-sm">
              <p className="font-medium text-navy">{c.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{[c.city, c.kind, c.phone].filter(Boolean).join(' · ')}</p>
              {c.hours && <p className="mt-1 text-xs text-muted-foreground">{c.hours}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** A wrapped list of links to other place pages. */
export function PlaceLinks({ id, title, intro, links }: { id: string; title: string; intro?: string; links: { href: string; label: string; note?: string }[] }) {
  if (links.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>{title}</h2>
      {intro && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={LINK}>{l.label}</Link>
            {l.note && <span className="ml-2 text-xs text-muted-foreground">{l.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

import { NoticeTable } from '@/components/layoffs/NoticeTable'
import type { LayoffStats } from '@/lib/places/places'
import type { PublicNotice } from '@/lib/warn/layoff-pages'

/** WARN notices for a place: the totals, the newest filings, and a link to the full state record. */
export function LayoffsSection({ id, title, scope, stats, notices, trackerHref, placeHref }: {
  id: string; title: string; scope: string; stats: LayoffStats; notices: PublicNotice[]; trackerHref: string | null
  placeHref?: (place: string | null) => string | null
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>{title}</h2>
      {stats.notices > 0 ? (
        <>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat value={stats.notices.toLocaleString()} label="WARN layoff notices, last 12 months" />
            <Stat value={stats.workers.toLocaleString()} label="workers named" note="A floor: states may leave out counts" />
            <Stat value={stats.employers.toLocaleString()} label={stats.employers === 1 ? 'employer' : 'employers'} />
          </ul>
          <div className="mt-4">
            <NoticeTable notices={notices.slice(0, 15)} caption={`WARN notices filed in ${scope}, newest first`} linkEmployer page="state" placeHref={placeHref} />
          </div>
        </>
      ) : (
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">No WARN layoff notices naming {scope} in the last 12 months are on file. WARN covers employers with 100 or more workers, so smaller layoffs are not in it.</p>
      )}
      {trackerHref && <p className="mt-3 text-sm"><Link href={trackerHref} className={LINK}>All layoff notices in the state</Link></p>}
    </section>
  )
}
