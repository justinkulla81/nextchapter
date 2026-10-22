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


interface LocalGroup { key: string; label: string; name: string; website: string | null; contact: string | null }
interface LocalNetwork { counts: { boards: number; centers: number; edo: number; chambers: number; other: number }; top: LocalGroup[] }

/** Every workforce, job-center, economic-development and chamber group we hold for one county, counted by kind with the best-fit few listed. */
async function loadLocalNetwork(fips: string, countyKey: string | null, state: string): Promise<LocalNetwork> {
  const key = (countyKey ?? '').replace(/\s+/g, '')
  const [boards, centers, leads, partners] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; website: string | null; directorName: string | null; directorTitle: string | null; fitScore: number | null }[]>`
      select id, name, website, "directorName", "directorTitle", "fitScore" from "WorkforceBoard"
       where state = ${state} and statewide = false and (${key} = any(counties) or ${key} = any("placeCounties"))`,
    prisma.$queryRaw<{ id: string; name: string; centerType: string | null; detailsUrl: string | null; businessEmail: string | null; fitScore: number | null }[]>`
      select id, name, "centerType", "detailsUrl", "businessEmail", "fitScore" from "AmericanJobCenter" where "countyFips" = ${fips}`,
    prisma.$queryRaw<{ id: string; name: string; kind: string; website: string | null; contactName: string | null; contactTitle: string | null; fitScore: number | null }[]>`
      select id, name, kind, website, "contactName", "contactTitle", "fitScore" from "GeoOrgLead" where "geoAreaId" = ${fips} and "dismissedAt" is null`,
    prisma.$queryRaw<{ id: string; name: string; kind: string; website: string | null; contactName: string | null; contactTitle: string | null; fitScore: number | null }[]>`
      select id, name, kind, website, "contactName", "contactTitle", "fitScore" from "LocalPartnerOrg" where state = ${state} and ${key} = any(counties)`,
  ])
  const byFit = <T extends { fitScore: number | null }>(a: T[]) => [...a].sort((x, y) => (y.fitScore ?? -1) - (x.fitScore ?? -1))
  const who = (n: string | null, t: string | null) => (n ? `${n}${t ? `, ${t}` : ''}` : null)
  const edoLeads = leads.filter((l) => l.kind === 'ECON_DEV')
  const chambers = leads.filter((l) => l.kind === 'CHAMBER')
  const otherLeads = leads.filter((l) => l.kind === 'WORKFORCE')
  const top: LocalGroup[] = [
    ...byFit(boards).slice(0, 2).map((b) => ({ key: `b${b.id}`, label: 'Workforce board', name: b.name, website: b.website, contact: who(b.directorName, b.directorTitle) })),
    ...byFit(centers).slice(0, 2).map((c) => ({ key: `c${c.id}`, label: 'Job center', name: c.name, website: c.detailsUrl, contact: c.businessEmail })),
    ...byFit(partners).slice(0, 3).map((x) => ({ key: `p${x.id}`, label: x.kind === 'EDD' ? 'EDA district' : x.kind === 'STATE_AGENCY' ? 'State agency' : 'Economic development', name: x.name, website: x.website, contact: who(x.contactName, x.contactTitle) })),
    ...byFit(edoLeads).slice(0, 3).map((x) => ({ key: `e${x.id}`, label: 'Economic development', name: x.name, website: x.website, contact: who(x.contactName, x.contactTitle) })),
    ...byFit(chambers).slice(0, 2).map((x) => ({ key: `h${x.id}`, label: 'Chamber', name: x.name, website: x.website, contact: who(x.contactName, x.contactTitle) })),
    ...byFit(otherLeads).slice(0, 2).map((x) => ({ key: `w${x.id}`, label: 'Workforce', name: x.name, website: x.website, contact: who(x.contactName, x.contactTitle) })),
  ]
  return { counts: { boards: boards.length, centers: centers.length, edo: edoLeads.length + partners.length, chambers: chambers.length, other: otherLeads.length }, top }
}

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
    presidentName: string | null; presidentTitle: string | null; phone: string | null
  }[]>`
    select l.id, l.sector, l.city, l.state, l."countyFips", l."countyKey", p.enrollment, p."alumniEstimate", p."alumniReported", p."alumniEstimateMethod",
      p."topMajors", p.earnings10, p."hasRetraining", p."presidentName", p."presidentTitle", p.phone
    from "LocalCollege" l left join "CollegeProfile" p on p.unitid = l.id where l."crmOrgId" = ${orgId} limit 1`
  const area = college?.countyFips ? await prisma.geoArea.findUnique({ where: { id: college.countyFips } }) : null
  const local = college?.countyFips ? await loadLocalNetwork(college.countyFips, college.countyKey, college.state) : null
  const contacts = college
    ? await prisma.collegeContact.findMany({ where: { collegeId: college.id }, select: { id: true, role: true, name: true, title: true, email: true, guessedEmail: true, phone: true, crmPersonId: true }, orderBy: [{ email: { sort: 'asc', nulls: 'last' } }] })
    : []
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
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Workforce and economic development in their area</h4>
            {local && (
              <p className="mt-1 text-sm">
                {local.counts.boards} workforce {local.counts.boards === 1 ? 'board' : 'boards'} · {local.counts.centers} American Job {local.counts.centers === 1 ? 'Center' : 'Centers'} · {local.counts.edo} economic development {local.counts.edo === 1 ? 'group' : 'groups'} · {local.counts.chambers} {local.counts.chambers === 1 ? 'chamber' : 'chambers'} · {local.counts.other} other workforce {local.counts.other === 1 ? 'group' : 'groups'}
              </p>
            )}
            {local && local.top.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {local.top.map((g) => (
                  <li key={g.key}>
                    <span className="text-xs uppercase text-muted-foreground">{g.label}</span>{' '}
                    {g.website ? <a href={g.website} target="_blank" rel="noreferrer" className="font-medium underline">{g.name}</a> : <span className="font-medium">{g.name}</span>}
                    {g.contact && <span className="text-muted-foreground"> · {g.contact}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-muted-foreground">None on file for this county.</p>}
            <p className="mt-1 text-xs text-muted-foreground">Highest fit first. The full list is on the geography page for {area.name}.</p>
          </div>
        </div>
      ) : college ? (
        <p className="mt-4 text-sm text-muted-foreground">No county labor-market data matched this college yet.</p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No location data is tied to this organization yet, so local unemployment and workforce boards are not shown.</p>
      )}

      {college && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Who to talk to at {org.name}</h3>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
            <li className="flex flex-wrap items-baseline justify-between gap-2 p-2">
              <span><span className="text-xs uppercase text-muted-foreground">President</span> <span className="font-medium">{college.presidentName ?? 'Not on file'}</span>{college.presidentTitle && <span className="text-muted-foreground">, {college.presidentTitle}</span>}</span>
              <span className="text-xs text-muted-foreground">{college.phone ?? 'No email on file'}</span>
            </li>
            {(['career', 'alumni', 'development', 'execEd'] as const).map((role) => {
              const mine = contacts.filter((c) => c.role === role).slice(0, 2)
              const label = { career: 'Career services', alumni: 'Alumni relations', development: 'Development', execEd: 'Executive education' }[role]
              if (!mine.length) return (
                <li key={role} className="flex flex-wrap items-baseline justify-between gap-2 p-2"><span className="text-xs uppercase text-muted-foreground">{label}</span><span className="text-xs text-muted-foreground">Not found yet</span></li>
              )
              return mine.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 p-2">
                  <span><span className="text-xs uppercase text-muted-foreground">{label}</span> <span className="font-medium">{c.name ?? 'Office'}</span>{c.title && <span className="text-muted-foreground">, {c.title}</span>}</span>
                  <span className="text-xs">{c.email ?? (c.guessedEmail ? <span className="text-muted-foreground" title="Guessed from the college's email format. Not confirmed.">{c.guessedEmail} (guess)</span> : <span className="text-muted-foreground">No email</span>)}</span>
                </li>
              ))
            })}
          </ul>
        </div>
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
