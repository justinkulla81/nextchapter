import { prisma } from '@/lib/prisma'
import { OCCUPATION_TRENDS_SOURCE } from '@/lib/market/occupation-trends-data'
import { degreeExposure } from '@/lib/crm/degree-ai-exposure'

const TYPE_LABEL: Record<string, string> = {
  VC_FUND: 'VC fund', ANGEL_SYNDICATE: 'Angel syndicate', FUNDER_GRANT: 'Funder', EMPLOYER: 'Employer', OUTPLACEMENT_LEAD: 'Outplacement lead',
  OUTPLACEMENT_FIRM: 'Outplacement firm', SEARCH_FIRM: 'Search firm', COACHING_FIRM: 'Coaching firm', UNIVERSITY: 'Higher ed', THINK_TANK: 'Think tank',
  GOVERNMENT: 'Government', FOUNDATION: 'Foundation', NONPROFIT: 'Nonprofit', MEDIA: 'Media', ACCELERATOR: 'Accelerator', VENDOR: 'Vendor', OTHER: 'Other',
}
const SECTOR: Record<number, string> = {
  1: 'Public four-year', 2: 'Private nonprofit four-year', 3: 'For-profit four-year', 4: 'Community college (public two-year)',
  5: 'Private nonprofit two-year', 6: 'For-profit two-year',
}
const BAND_STYLE = { HIGH: 'bg-red-100 text-red-900', MEDIUM: 'bg-amber-100 text-amber-900', LOW: 'bg-green-100 text-green-900' } as const
const BAND_LABEL = { HIGH: 'High exposure', MEDIUM: 'Medium', LOW: 'Low' } as const
const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`

type Board = { id: string; name: string; website: string | null; statewide?: boolean; directorName: string | null; directorTitle: string | null }

function F({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? <span className="font-normal text-muted-foreground">Not on file</span>}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  )
}

/**
 * What to know before talking to someone at this organization: the kind of customer it is, the labor market where
 * it sits, the workforce board for that area and, for colleges, alumni size and how exposed its graduates' fields are to AI.
 * Shown on the person page so none of it needs a second click. Reads only data we already hold; no model calls.
 */
export async function CrmOrgContext({ orgId }: { orgId: string }) {
  const org = await prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { id: true, name: true, orgTypes: true, hqCity: true, usState: true } })
  if (!org) return null
  const [college] = await prisma.$queryRaw<{
    id: string; sector: number | null; city: string | null; state: string; countyFips: string | null; countyKey: string | null
    enrollment: number | null; alumniEstimate: number | null; alumniReported: number | null; alumniEstimateMethod: string | null
    topMajors: { field: string; share: number }[] | null; earnings10: number | null; hasRetraining: boolean | null
  }[]>`
    select l.id, l.sector, l.city, l.state, l."countyFips", l."countyKey", p.enrollment, p."alumniEstimate", p."alumniReported", p."alumniEstimateMethod",
      p."topMajors", p.earnings10, p."hasRetraining"
    from "LocalCollege" l left join "CollegeProfile" p on p.unitid = l.id where l."crmOrgId" = ${orgId} limit 1`
  const area = college?.countyFips ? await prisma.geoArea.findUnique({ where: { id: college.countyFips } }) : null
  const boards = ((Array.isArray(area?.wioaBoards) ? area!.wioaBoards : []) as unknown as Board[])
  const localBoards = boards.filter((b) => !b.statewide)
  const stateBoards = boards.filter((b) => b.statewide)
  const exposure = college ? degreeExposure(college.topMajors) : null

  const types = org.orgTypes.map((t) => TYPE_LABEL[t] ?? t)
  const customerType = college ? `Higher ed · ${college.sector ? SECTOR[college.sector] ?? 'College' : 'College'}` : types.join(' · ') || null
  const place = college ? [college.city, college.state].filter(Boolean).join(', ') : [org.hqCity, org.usState].filter(Boolean).join(', ')

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold">Account context</h2>
      <dl className="mt-3 grid gap-4 sm:grid-cols-3">
        <F label="Customer type" value={customerType} note={place || undefined} />
        {college && <F label="Alumni" value={(college.alumniReported ?? college.alumniEstimate)?.toLocaleString()} note={college.alumniReported ? 'Reported' : college.alumniEstimateMethod ?? undefined} />}
        {college && <F label="Enrollment" value={college.enrollment?.toLocaleString()} />}
      </dl>

      {area ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Their community: {area.name}, {area.state}</h3>
          <dl className="mt-2 grid gap-4 sm:grid-cols-3">
            <F label="Unemployment rate" value={area.unemploymentRate != null ? `${area.unemploymentRate.toFixed(1)}%` : null}
              note={[area.unemploymentRatePrior != null ? `${area.unemploymentRatePrior.toFixed(1)}% a year ago` : null, area.unemploymentAsOf ? `as of ${area.unemploymentAsOf}` : null].filter(Boolean).join(' · ') || undefined} />
            <F label="White-collar unemployment (estimate)" value={area.wcUnemploymentEst != null ? `${area.wcUnemploymentEst.toFixed(1)}%` : null}
              note={area.whiteCollarShare != null ? `${pct(area.whiteCollarShare)} of jobs are white-collar` : undefined} />
            <F label="Layoffs filed" value={`${area.layoffs90d.toLocaleString()} in 90 days`} note={`${area.layoffs12mo.toLocaleString()} jobs, ${area.layoffEvents12mo} notices in 12 months`} />
          </dl>
          <div className="mt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Workforce development in their area</h4>
            {localBoards.length + stateBoards.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No board on file for this county.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {[...localBoards, ...stateBoards].map((b) => (
                  <li key={b.id}>
                    {b.website ? <a href={b.website} target="_blank" rel="noreferrer" className="font-medium underline">{b.name}</a> : <span className="font-medium">{b.name}</span>}
                    {b.statewide && <span className="text-muted-foreground"> (state board)</span>}
                    {b.directorName && <span className="text-muted-foreground"> · {b.directorName}{b.directorTitle ? `, ${b.directorTitle}` : ''}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : college ? (
        <p className="mt-4 text-sm text-muted-foreground">No county labor-market data matched this college yet.</p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No location data is tied to this organization yet, so local unemployment and workforce boards are not shown.</p>
      )}

      {exposure && exposure.majors.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Degrees awarded and AI exposure of the jobs they lead to</h3>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
            {exposure.majors.map((m) => (
              <li key={m.field} className="flex flex-wrap items-center justify-between gap-2 p-2">
                <span><span className="font-medium">{m.field}</span> <span className="text-muted-foreground">{pct(m.share)} of degrees</span></span>
                {m.band ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{m.occupationGroup} jobs: {m.employmentChangePct! > 0 ? '+' : ''}{m.employmentChangePct}% since 2022</span>
                    <span className={`rounded px-2 py-0.5 font-medium ${BAND_STYLE[m.band]}`}>{BAND_LABEL[m.band]} · {Math.round(m.aiExposure!)}</span>
                  </span>
                ) : <span className="text-xs text-muted-foreground">General or mixed field, not mapped</span>}
              </li>
            ))}
          </ul>
          {exposure.weightedExposure != null && (
            <p className="mt-2 text-sm">
              {pct(exposure.highShare)} of their degrees feed highly exposed occupations; weighted exposure {Math.round(exposure.weightedExposure)} out of 100 across the {pct(exposure.coveredShare)} of degrees we could map.
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Exposure is what AI could do in principle (Eloundou et al. 2024), not a measured job loss. Source: {OCCUPATION_TRENDS_SOURCE.title}, {OCCUPATION_TRENDS_SOURCE.edition}. Fields are matched to occupation groups by us.
          </p>
        </div>
      )}
    </section>
  )
}
