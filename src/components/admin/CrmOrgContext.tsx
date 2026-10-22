import { prisma } from '@/lib/prisma'
import { OCCUPATION_TRENDS_SOURCE } from '@/lib/market/occupation-trends-data'
import { degreeExposure } from '@/lib/crm/degree-ai-exposure'
import { LAYOFF_DAYS, loadCountyJobs, loadCountyLayoffs, loadLocalNetwork } from '@/lib/crm/org-context-data'

const TYPE_LABEL: Record<string, string> = {
  VC_FUND: 'VC fund', ANGEL_SYNDICATE: 'Angel syndicate', FUNDER_GRANT: 'Funder', EMPLOYER: 'Employer', OUTPLACEMENT_LEAD: 'Outplacement lead',
  OUTPLACEMENT_FIRM: 'Outplacement firm', SEARCH_FIRM: 'Search firm', COACHING_FIRM: 'Coaching firm', UNIVERSITY: 'Higher ed', THINK_TANK: 'Think tank',
  GOVERNMENT: 'Government', FOUNDATION: 'Foundation', NONPROFIT: 'Nonprofit', MEDIA: 'Media', ACCELERATOR: 'Accelerator', VENDOR: 'Vendor', OTHER: 'Other',
}
const SECTOR: Record<number, string> = {
  1: 'Public four-year', 2: 'Private nonprofit four-year', 3: 'For-profit four-year', 4: 'Community college',
  5: 'Private nonprofit two-year', 6: 'For-profit two-year',
}
const BAND_BAR = { HIGH: 'bg-red-500', MEDIUM: 'bg-amber-500', LOW: 'bg-green-600' } as const
const BAND_TEXT = { HIGH: 'text-red-700', MEDIUM: 'text-amber-700', LOW: 'text-green-700' } as const
const BAND_LABEL = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' } as const
const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`
const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold leading-tight">{value ?? <span className="text-sm font-normal text-muted-foreground">Not on file</span>}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  )
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Row({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
      <span className="min-w-0"><span className="mr-2 inline-block w-28 text-xs uppercase tracking-wide text-muted-foreground">{label}</span>{children}</span>
      {right && <span className="text-xs text-muted-foreground">{right}</span>}
    </li>
  )
}

/**
 * What to know before talking to someone at this organization, grouped: the institution and who to talk to, the local job market (unemployment,
 * layoffs, open jobs), the workforce and economic-development groups around it, and what its graduates are exposed to. Reads only data we hold; no model calls.
 */
export async function CrmOrgContext({ orgId }: { orgId: string }) {
  const org = await prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { id: true, name: true, orgTypes: true, hqCity: true, usState: true } })
  if (!org) return null
  const [college] = await prisma.$queryRaw<{
    id: string; sector: number | null; city: string | null; state: string; countyFips: string | null; countyKey: string | null
    enrollment: number | null; alumniEstimate: number | null; alumniReported: number | null; alumniEstimateMethod: string | null
    topMajors: { field: string; share: number }[] | null; earnings10: number | null
    presidentName: string | null; presidentTitle: string | null; phone: string | null
  }[]>`
    select l.id, l.sector, l.city, l.state, l."countyFips", l."countyKey", p.enrollment, p."alumniEstimate", p."alumniReported", p."alumniEstimateMethod",
      p."topMajors", p.earnings10, p."presidentName", p."presidentTitle", p.phone
    from "LocalCollege" l left join "CollegeProfile" p on p.unitid = l.id where l."crmOrgId" = ${orgId} limit 1`
  const area = college?.countyFips ? await prisma.geoArea.findUnique({ where: { id: college.countyFips } }) : null
  const [local, layoffs, jobs, contacts] = await Promise.all([
    area && college ? loadLocalNetwork(area.id, college.countyKey, college.state) : null,
    area ? loadCountyLayoffs(area.state, area.name) : null,
    area ? loadCountyJobs(area.id, area.state, area.name) : null,
    college ? prisma.collegeContact.findMany({ where: { collegeId: college.id }, select: { id: true, role: true, name: true, title: true, email: true, guessedEmail: true }, orderBy: [{ email: { sort: 'asc', nulls: 'last' } }] }) : [],
  ])
  const exposure = college ? degreeExposure(college.topMajors) : null
  const types = org.orgTypes.map((t) => TYPE_LABEL[t] ?? t)
  const customerType = college ? `Higher ed` : types.join(' · ') || null
  const customerNote = college ? `${college.sector ? SECTOR[college.sector] ?? 'College' : 'College'} · ${[college.city, college.state].filter(Boolean).join(', ')}` : [org.hqCity, org.usState].filter(Boolean).join(', ') || undefined
  const alumni = college ? college.alumniReported ?? college.alumniEstimate : null

  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Account context</h2>
        <span className="text-xs text-muted-foreground">{org.name}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Customer type" value={customerType} note={customerNote} />
        <Tile label="Alumni" value={alumni?.toLocaleString()} note={college ? (college.alumniReported ? 'Reported' : 'Estimate') : undefined} />
        <Tile label="Unemployment" value={area?.unemploymentRate != null ? `${area.unemploymentRate.toFixed(1)}%` : null}
          note={area ? `${area.name}${area.unemploymentRatePrior != null ? ` · ${area.unemploymentRatePrior.toFixed(1)}% a year ago` : ''}` : undefined} />
        <Tile label={`Layoffs, ${LAYOFF_DAYS} days`} value={layoffs ? `${layoffs.jobs.toLocaleString()} jobs` : null} note={layoffs ? `${layoffs.employers} employers · ${layoffs.filings} filings` : undefined} />
        <Tile label="Open jobs in area" value={jobs ? jobs.roles.toLocaleString() : area ? '0' : null} note={jobs ? `${jobs.employers.toLocaleString()} employers · ${jobs.professional.toLocaleString()} professional-level` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {college && (
          <Card title="Who to talk to" aside={college.enrollment ? `${college.enrollment.toLocaleString()} students` : undefined}>
            <ul className="divide-y divide-border text-sm">
              <Row label="President" right={college.phone ?? undefined}>
                <span className="font-medium">{college.presidentName ?? 'Not on file'}</span>{college.presidentTitle && <span className="text-muted-foreground">, {college.presidentTitle}</span>}
              </Row>
              {(['career', 'alumni', 'development', 'execEd'] as const).flatMap((role) => {
                const label = { career: 'Career services', alumni: 'Alumni', development: 'Development', execEd: 'Exec ed' }[role]
                const mine = contacts.filter((c) => c.role === role).slice(0, 2)
                if (!mine.length) return [<Row key={role} label={label} right="Not found yet"><span className="text-muted-foreground">—</span></Row>]
                return mine.map((c) => (
                  <Row key={c.id} label={label} right={c.email ?? (c.guessedEmail ? `${c.guessedEmail} (guess)` : 'No email')}>
                    <span className="font-medium">{c.name ?? 'Office'}</span>{c.title && <span className="text-muted-foreground">, {c.title}</span>}
                  </Row>
                ))
              })}
            </ul>
          </Card>
        )}

        {area && (
          <Card title={`Local job market · ${area.name}, ${area.state}`} aside={area.unemploymentAsOf ? `unemployment as of ${area.unemploymentAsOf}` : undefined}>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">White-collar unemployment (estimate)</dt><dd className="font-medium">{area.wcUnemploymentEst != null ? `${area.wcUnemploymentEst.toFixed(1)}%` : 'Not on file'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">White-collar share of jobs</dt><dd className="font-medium">{area.whiteCollarShare != null ? pct(area.whiteCollarShare) : 'Not on file'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Median posted pay</dt><dd className="font-medium">{jobs?.medianPay ? `$${jobs.medianPay.toLocaleString()}` : 'Not enough postings'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Most open roles</dt><dd className="font-medium">{jobs?.topFunctions.length ? jobs.topFunctions.slice(0, 3).map((f) => f.label).join(', ') : 'None'}</dd></div>
            </dl>
            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layoffs in the last {LAYOFF_DAYS} days</h4>
            {layoffs && layoffs.rows.length > 0 ? (
              <>
                <table className="mt-1 w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {layoffs.rows.slice(0, 7).map((r) => (
                      <tr key={r.employer}>
                        <td className="py-1 pr-2 font-medium">{r.employer}{r.filings > 1 && <span className="font-normal text-muted-foreground"> · {r.filings} sites</span>}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{r.employees.toLocaleString()}</td>
                        <td className="py-1 text-right text-xs text-muted-foreground">{shortDate(r.noticeDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-muted-foreground">
                  {layoffs.rows.length > 7 ? `Top 7 of ${layoffs.employers} employers. ` : ''}Total {layoffs.jobs.toLocaleString()} jobs in {layoffs.filings} state WARN filings.
                </p>
              </>
            ) : <p className="mt-1 text-sm text-muted-foreground">No state layoff filings in this window.</p>}
            <p className="mt-3 text-xs text-muted-foreground">Open jobs are roles our crawler saw in the last 14 days whose location names a city in the county; remote roles are not counted.</p>
          </Card>
        )}
      </div>

      {local && area && (
        <Card title="Workforce and economic development in their area" aside={`full list: geography page for ${area.name}`}>
          <div className="flex flex-wrap gap-2 text-sm">
            {([['Workforce boards', local.counts.boards], ['American Job Centers', local.counts.centers], ['Economic development', local.counts.edo], ['Chambers', local.counts.chambers], ['Other workforce groups', local.counts.other]] as const).map(([l, n]) => (
              <span key={l} className="rounded-full bg-muted px-3 py-1"><span className="font-semibold">{n}</span> <span className="text-muted-foreground">{l}</span></span>
            ))}
          </div>
          {local.top.length > 0 ? (
            <ul className="mt-3 grid gap-x-6 text-sm sm:grid-cols-2">
              {local.top.map((g) => (
                <li key={g.key} className="border-b border-border py-1.5">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">{g.label}</span>
                  {g.website ? <a href={g.website} target="_blank" rel="noreferrer" className="font-medium underline">{g.name}</a> : <span className="font-medium">{g.name}</span>}
                  {g.contact && <span className="block text-xs text-muted-foreground">{g.contact}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted-foreground">None on file for this county.</p>}
        </Card>
      )}

      {!area && (
        <p className="text-sm text-muted-foreground">{college ? 'No county labor-market data matched this college yet.' : 'No location data is tied to this organization yet, so local unemployment, layoffs, jobs and workforce groups are not shown.'}</p>
      )}

      {exposure && exposure.majors.length > 0 && (
        <Card title="Degrees awarded and AI exposure of the jobs they lead to" aside={exposure.weightedExposure != null ? `${pct(exposure.highShare)} of degrees in high-exposure fields` : undefined}>
          <ul className="divide-y divide-border text-sm">
            {exposure.majors.map((m) => (
              <li key={m.field} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-2 sm:grid-cols-[14rem_1fr_9rem]">
                <span><span className="font-medium">{m.field}</span> <span className="text-muted-foreground">{pct(m.share)}</span></span>
                {m.band ? (
                  <>
                    <span className="text-xs text-muted-foreground">{m.occupationGroup} jobs {m.employmentChangePct! > 0 ? '+' : ''}{m.employmentChangePct}% since 2022</span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-20 overflow-hidden rounded bg-muted"><span className={`block h-full ${BAND_BAR[m.band]}`} style={{ width: `${Math.round(m.aiExposure!)}%` }} /></span>
                      <span className={`text-xs font-semibold ${BAND_TEXT[m.band]}`}>{BAND_LABEL[m.band]} · {Math.round(m.aiExposure!)}</span>
                    </span>
                  </>
                ) : <span className="col-span-2 text-xs text-muted-foreground">General or mixed field, not mapped</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Exposure is what AI could do in principle (Eloundou et al. 2024), 0 to 100, not a measured job loss. Source: {OCCUPATION_TRENDS_SOURCE.title}, {OCCUPATION_TRENDS_SOURCE.edition}. We matched fields to occupation groups.
            {exposure.weightedExposure != null && ` Weighted exposure ${Math.round(exposure.weightedExposure)} across the ${pct(exposure.coveredShare)} of degrees we could map.`}
          </p>
        </Card>
      )}
    </section>
  )
}
