import { areasForCompany, localPartnersForArea } from '@/lib/geo/local-partners'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const money = (n: number | null) => (n ? `$${(n / 1e6).toFixed(1)}M revenue` : null)

function Contact({ name, email, phone }: { name?: string | null; email?: string | null; phone?: string | null }) {
  const bits = [name, email, phone].filter(Boolean)
  return bits.length ? <span className="text-muted-foreground"> — {bits.join(' · ')}</span> : null
}

function Link({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">{children}</a> : <>{children}</>
}

/** The local workforce, economic-development and college partners for every county a company operates in. */
export async function CompanyLocalPartners({ companyId }: { companyId: string }) {
  const areas = await areasForCompany(companyId)
  const partners = (await Promise.all(areas.slice(0, 4).map((a) => localPartnersForArea(a.areaId)))).filter((p): p is NonNullable<typeof p> => !!p)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Local partners</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {partners.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No location on file for this company yet. Partners attach as soon as a layoff notice names a county or the CRM
            record has a headquarters city.
          </p>
        )}
        {partners.map((p, i) => (
          <section key={p.area.id} className="space-y-3 text-sm">
            <h3 className="font-semibold text-foreground">
              {p.area.name}, {p.area.state}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {areas[i].via === 'layoff-notice' ? 'from a layoff notice' : areas[i].via === 'job-posting' ? `job posting in ${areas[i].detail ?? ''}` : `CRM headquarters ${areas[i].detail ?? ''}`}
              </span>
            </h3>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Workforce board (WIOA)</h4>
              {p.boards.length ? (
                <ul className="list-disc pl-5">
                  {p.boards.map((b) => (
                    <li key={b.id}><Link href={b.website}>{b.name}</Link>{b.statewide ? ' (state)' : ''}<Contact name={b.directorName} email={b.directorEmail} phone={b.directorPhone} /></li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground">None on file.</p>}
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">American Job Centers</h4>
              {p.jobCenters.length ? (
                <ul className="list-disc pl-5">
                  {p.jobCenters.map((c) => (
                    <li key={c.id}><Link href={c.detailsUrl}>{c.name}</Link>{c.centerType ? ` (${c.centerType})` : ''}{c.city ? `, ${c.city}` : ''}<Contact email={c.businessEmail} phone={c.phone} /></li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground">None on file.</p>}
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Economic development</h4>
              <ul className="list-disc pl-5">
                {p.districts.map((d) => (
                  <li key={d.id}><Link href={d.website}>{d.name}</Link> (EDA district)<Contact name={d.contactName} email={d.email} /></li>
                ))}
                {p.localEdos.map((e) => (
                  <li key={e.id}><Link href={e.website}>{e.name}</Link>{money(e.revenue) ? ` · ${money(e.revenue)}` : ''}<Contact name={e.contactName} email={e.email} phone={e.phone} />{e.confidence === 'low' ? ' (unverified)' : ''}</li>
                ))}
                {p.stateAgency && <li><Link href={p.stateAgency.website}>{p.stateAgency.name}</Link> (state)<Contact name={p.stateAgency.contactName} email={p.stateAgency.email} phone={p.stateAgency.phone} /></li>}
                {!p.districts.length && !p.localEdos.length && !p.stateAgency && <li className="list-none text-muted-foreground">None on file.</li>}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Colleges and universities</h4>
              {p.universities.length ? (
                <ul className="list-disc pl-5">
                  {p.universities.map((u) => (
                    <li key={u.name}>{u.name}{u.city ? `, ${u.city}` : ''}{u.enrollment ? ` · ${u.enrollment.toLocaleString()} students` : ''}{u.nearby ? ' · elsewhere in this workforce area' : ''}</li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground">None on file.</p>}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
