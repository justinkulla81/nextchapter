import Link from 'next/link'
import { H2, LINK, SeoPage, Stat, ActionBand } from '@/components/seo/SeoPage'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { COLLEGE_SECTORS } from '@/lib/workforce/board-area'
import { stateName, stateSlug } from '@/lib/seo/states'
import { orgJsonLd } from '@/lib/seo/org-page-jsonld'
import { ORG_PAGE_ROOT, orgPagePath } from '@/lib/seo/org-page-rules'
import { placeUrl } from '@/lib/places/places'
import { periodLabel, rateText } from '@/lib/seo/workforce-pages'
import type { AreaJob, HiringEmployer, OrgPage } from '@/lib/seo/org-pages'

const n0 = (n: number) => n.toLocaleString('en-US')
/** The street line as the source gives it; the city, state and zip are added only when it does not already end with them. */
function addressLine(row: { street: string | null; city: string | null; state: string; zip: string | null }): string {
  if (row.street && /\b\d{5}(-\d{4})?$/.test(row.street.trim())) return row.street.trim()
  return [row.street, [row.city, row.state].filter(Boolean).join(', ') + (row.zip ? ` ${row.zip}` : '')].filter(Boolean).join(', ')
}

const ROOT_NAME = { JOB_CENTER: 'American Job Centers', ECON_DEV: 'Economic development', WORKFORCE_BOARD: 'Workforce boards' } as const

/** The page for an American Job Center or an economic development organization. */
export function OrgPageView({ page, path, hiring, claimSlug }: {
  page: OrgPage
  path: string
  hiring: { employers: HiringEmployer[]; jobs: AreaJob[] }
  claimSlug: string | null
}) {
  const { row, area, blocks: b } = page
  const st = stateName(row.state)
  const ss = stateSlug(row.state)
  const where = area.statewide ? `all of ${st}` : area.counties.map((c) => c.name).slice(0, 4).join(', ') + (area.counties.length > 4 ? ` and ${area.counties.length - 4} more` : '')
  const props = { kind: row.kind, orgId: row.id, state: row.state, slug: row.slug }
  const lede = (
    <>
      {row.serviceArea && <span className="block text-sm">Service area: {row.serviceArea}</span>}
      {row.label}{row.city ? ` in ${row.city}, ${row.state}` : ` in ${st}`}.{' '}
      {area.statewide || area.counties.length > 0 ? `It serves ${where}, where ${n0(b.jobsOpen)} professional ${b.jobsOpen === 1 ? 'job is' : 'jobs are'} open today.` : ''}
    </>
  )
  return (
    <SeoPage
      trail={[{ name: ROOT_NAME[row.kind], path: ORG_PAGE_ROOT[row.kind] }, { name: st, path: `${ORG_PAGE_ROOT[row.kind]}/${ss}` }, { name: row.name, path }]}
      h1={row.name}
      lede={lede}
      jsonLd={orgJsonLd(page, path, hiring.jobs)}
    >
      <section aria-labelledby="market" className="mt-10">
        <h2 id="market" className={H2}>Jobs where it serves</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={n0(b.jobsOpen)} label="open professional jobs" note={area.statewide ? `Statewide, ${st}` : `In ${area.counties.length} ${area.counties.length === 1 ? 'county' : 'counties'}`} />
          <Stat value={n0(b.entryLevel)} label="entry-level or early-career" />
          <Stat value={n0(b.noExperience)} label="say no experience is needed" note={b.training > 0 ? `${n0(b.training)} more describe paid training` : undefined} />
          {b.labor && <Stat value={rateText(b.labor)} label={`unemployment, ${periodLabel(b.labor.period)}`} note={b.population ? `${n0(b.population)} residents` : undefined} />}
        </ul>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">Counts are live postings from employers’ own career sites in the area’s cities, checked daily.</p>
      </section>

      <section aria-labelledby="contact" className="mt-12">
        <h2 id="contact" className={H2}>How to reach it</h2>
        <dl className="mt-4 grid max-w-3xl gap-3 rounded-xl border border-border bg-white p-5 text-sm sm:grid-cols-2">
          {(row.street || row.city) && <div><dt className="text-xs text-muted-foreground">Address</dt><dd>{addressLine(row)}</dd></div>}
          {row.phone && <div><dt className="text-xs text-muted-foreground">Phone</dt><dd><a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`} className={LINK}>{row.phone}</a></dd></div>}
          {row.hours && <div><dt className="text-xs text-muted-foreground">Hours</dt><dd>{row.hours}</dd></div>}
          {row.email && <div><dt className="text-xs text-muted-foreground">General inbox</dt><dd><a href={`mailto:${row.email}`} className={LINK}>{row.email}</a></dd></div>}
          {row.website && <div><dt className="text-xs text-muted-foreground">Website</dt><dd><TrackedLink href={row.website} rel="nofollow" event="org_page_outbound_clicked" properties={{ ...props, target: 'website' }} className={LINK}>{row.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</TrackedLink></dd></div>}
          {row.detailsUrl && <div><dt className="text-xs text-muted-foreground">Official listing</dt><dd><TrackedLink href={row.detailsUrl} rel="nofollow" event="org_page_outbound_clicked" properties={{ ...props, target: 'listing' }} className={LINK}>{row.kind === 'JOB_CENTER' ? 'CareerOneStop' : 'Source'}</TrackedLink></dd></div>}
        </dl>
      </section>

      {area.counties.length > 0 && (
        <section aria-labelledby="counties" className="mt-12">
          <h2 id="counties" className={H2}>{area.counties.length === 1 ? 'County served' : 'Counties served'}</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {area.counties.map((c) => <li key={c.fips}><Link href={placeUrl.county(ss, c.slug)} className={LINK}>{c.name}</Link></li>)}
          </ul>
        </section>
      )}

      {hiring.employers.length > 0 && (
        <section aria-labelledby="hiring" className="mt-12">
          <h2 id="hiring" className={H2}>Employers hiring most in the area</h2>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {hiring.employers.map((e) => (
              <li key={e.name} className="flex items-baseline justify-between gap-3 p-4">
                {e.href ? <Link href={e.href} className={`${LINK} font-medium`}>{e.name}</Link> : <span className="font-medium text-navy">{e.name}</span>}
                <span className="text-xs text-muted-foreground">{n0(e.openRoles)} open</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hiring.jobs.length > 0 && (
        <section aria-labelledby="roles" className="mt-12">
          <h2 id="roles" className={H2}>Recently verified roles</h2>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white text-sm">
            {hiring.jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                <Link href={`/jobs/${j.id}`} className={`${LINK} font-medium`}>{j.title}</Link>
                <span className="text-xs text-muted-foreground">{[j.company, j.location].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm"><Link href="/jobs" className={LINK}>Search all jobs</Link></p>
        </section>
      )}

      {b.colleges.length > 0 && (
        <section aria-labelledby="colleges" className="mt-12">
          <h2 id="colleges" className={H2}>Colleges in the area</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {b.colleges.map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-white p-4 text-sm">
                <p className="font-medium text-navy">{c.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{[c.city, c.sector ? COLLEGE_SECTORS[c.sector] : null].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
          {b.collegeCount > b.colleges.length && <p className="mt-2 text-xs text-muted-foreground">{n0(b.collegeCount - b.colleges.length)} more in the area.</p>}
        </section>
      )}

      {(b.centers.length > 0 || b.boards.length > 0 || b.partners.length > 0) && (
        <section aria-labelledby="partners" className="mt-12">
          <h2 id="partners" className={H2}>Other help in the same area</h2>
          <div className="mt-4 grid gap-6 text-sm sm:grid-cols-3">
            {b.boards.length > 0 && <div><p className="font-medium text-navy">Workforce boards</p><ul className="mt-2 space-y-1">{b.boards.map((x) => <li key={x.id}><Link href={orgPagePath('WORKFORCE_BOARD', ss, x.slug)} className={LINK}>{x.name}</Link></li>)}</ul></div>}
            {b.centers.length > 0 && <div><p className="font-medium text-navy">American Job Centers</p><ul className="mt-2 space-y-1">{b.centers.map((x) => <li key={x.id}><Link href={orgPagePath('JOB_CENTER', ss, x.slug)} className={LINK}>{x.name}</Link></li>)}</ul>{b.centerCount > b.centers.length && <p className="mt-1 text-xs text-muted-foreground">and {n0(b.centerCount - b.centers.length)} more</p>}</div>}
            {b.partners.length > 0 && <div><p className="font-medium text-navy">Economic development</p><ul className="mt-2 space-y-1">{b.partners.map((x) => <li key={x.id}><Link href={orgPagePath('ECON_DEV', ss, x.slug)} className={LINK}>{x.name}</Link></li>)}</ul></div>}
          </div>
        </section>
      )}

      <ActionBand
        title={`Run ${row.name}?`}
        body="Claim this page and set up a free workspace. Use a work email at your organization’s domain."
        label="Claim this page"
        href={claimSlug ? `/prepared/${claimSlug}` : '/government-workforce#claim'}
        event="org_page_claim_clicked"
        properties={{ ...props, hasClaimPage: !!claimSlug, jobsOpen: b.jobsOpen }}
      />

      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sources:</span> {row.sourceNote} for the organization; Census and the Bureau of Labor Statistics for the area; open jobs from employers’ career sites, checked daily.
        Last changed {page.lastModified.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.{' '}
        <Link href={`${ORG_PAGE_ROOT[row.kind]}/${ss}`} className={LINK}>All in {st}</Link>.
      </p>
    </SeoPage>
  )
}
