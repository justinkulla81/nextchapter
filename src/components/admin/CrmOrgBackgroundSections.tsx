import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { layoffSignalsFor, LAYOFF_WINDOW_MONTHS, type LayoffSignal } from '@/lib/crm/layoff-signals'

const ORG_SELECT = { id: true, name: true, canonicalNameNormalized: true, companyId: true } as const
type OrgRef = { id: string; name: string; canonicalNameNormalized: string; companyId: string | null }

function monthYear(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function layoffText(org: OrgRef, s: LayoffSignal) {
  return `${org.name} layoff, ${monthYear(s.date)}${s.employees ? ` · ${s.employees.toLocaleString()} roles` : ''}`
}

/**
 * The organization page's two background lists, plus the reverse view:
 *
 *  - Alumni in the CRM — people whose Education lists this school, with
 *    anyone hit by a recent layoff (at their current employer, or at the one
 *    they just left) or now between roles pulled to the top.
 *  - Former employees in the CRM — people whose last job was here.
 *  - Where people here went to school — for an employer, the schools of its
 *    current and former people, which is who to call when it has a layoff.
 *
 * Each only renders when it has rows, so an ordinary org page is unchanged.
 */
export async function CrmOrgBackgroundSections({ org }: { org: OrgRef }) {
  const [backgrounds, peopleHere] = await Promise.all([
    prisma.crmBackground.findMany({
      where: { orgId: org.id, person: { deletedAt: null } },
      select: {
        id: true, kind: true, detail: true,
        person: {
          select: {
            id: true, fullName: true,
            affiliations: { where: { isPrimary: true }, take: 1, select: { title: true, org: { select: ORG_SELECT } } },
            backgrounds: { where: { kind: 'FORMER_EMPLOYER' }, select: { org: { select: ORG_SELECT } } },
          },
        },
      },
    }),
    // People who work here now, or whose last job was here — and their schools.
    prisma.crmBackground.findMany({
      where: {
        kind: 'SCHOOL',
        person: {
          deletedAt: null,
          OR: [
            { affiliations: { some: { orgId: org.id, isPrimary: true } } },
            { backgrounds: { some: { orgId: org.id, kind: 'FORMER_EMPLOYER' } } },
          ],
        },
      },
      select: { org: { select: { id: true, name: true } }, person: { select: { id: true, fullName: true } } },
    }),
  ])

  const alumni = backgrounds.filter((b) => b.kind === 'SCHOOL')
  const formers = backgrounds.filter((b) => b.kind === 'FORMER_EMPLOYER')

  const orgsToCheck = new Map<string, OrgRef>([[org.id, org]])
  for (const b of backgrounds) {
    const current = b.person.affiliations[0]?.org
    if (current) orgsToCheck.set(current.id, current)
    for (const f of b.person.backgrounds) orgsToCheck.set(f.org.id, f.org)
  }
  const signals = await layoffSignalsFor([...orgsToCheck.values()])

  const alumniRows = alumni.map((b) => {
    const current = b.person.affiliations[0] ?? null
    const currentSignal = current ? signals.get(current.org.id) : undefined
    const left = b.person.backgrounds.find((f) => signals.has(f.org.id))
    const between = !!current?.org.name.toLowerCase().includes('unemployed')
    const flag = currentSignal && current
      ? layoffText(current.org, currentSignal)
      : left
        ? `Left ${layoffText(left.org, signals.get(left.org.id)!)}`
        : between ? 'Between roles' : null
    return { ...b, current, flag }
  }).sort((a, b) => Number(!!b.flag) - Number(!!a.flag) || a.person.fullName.localeCompare(b.person.fullName))
  const affected = alumniRows.filter((r) => r.flag).length

  const schools = new Map<string, { name: string; people: { id: string; fullName: string }[] }>()
  for (const r of peopleHere) {
    const s = schools.get(r.org.id) ?? { name: r.org.name, people: [] }
    if (!s.people.some((p) => p.id === r.person.id)) s.people.push(r.person)
    schools.set(r.org.id, s)
  }
  const schoolRows = [...schools.entries()].sort((a, b) => b[1].people.length - a[1].people.length)
  const ownSignal = signals.get(org.id)

  return (
    <>
      {alumniRows.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Alumni in the CRM ({alumniRows.length})</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            {affected > 0
              ? `${affected} affected — a layoff at their employer in the last ${LAYOFF_WINDOW_MONTHS} months, or between roles.`
              : `None affected by a layoff in the last ${LAYOFF_WINDOW_MONTHS} months.`}
          </p>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {alumniRows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <Link href={`/support/admin/crm/people/${r.person.id}`} className="font-medium hover:underline">{r.person.fullName}</Link>
                  {r.detail && <span className="text-muted-foreground"> — {r.detail}</span>}
                  {r.current && (
                    <span className="block text-xs text-muted-foreground">
                      {[r.current.title, r.current.org.name].filter(Boolean).join(' at ')}
                    </span>
                  )}
                </span>
                {r.flag && <span className="rounded-full bg-orange/15 px-1.5 py-0.5 text-xs font-medium text-orange">{r.flag}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {formers.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Former employees in the CRM ({formers.length})</h2>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {formers.map((b) => {
              const now = b.person.affiliations[0]
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    <Link href={`/support/admin/crm/people/${b.person.id}`} className="font-medium hover:underline">{b.person.fullName}</Link>
                    {b.detail && <span className="text-muted-foreground"> — was {b.detail}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{now ? `Now: ${now.org.name}` : 'No current employer on file'}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {schoolRows.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Where people here went to school</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            {ownSignal
              ? `${layoffText(org, ownSignal)}. These schools' alumni and career offices are a route to the people affected.`
              : 'Current and former people at this organization, by school.'}
          </p>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {schoolRows.map(([schoolId, s]) => (
              <li key={schoolId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/support/admin/crm/organizations/${schoolId}`} className="font-medium hover:underline">{s.name}</Link>
                <span className="text-xs text-muted-foreground">
                  {s.people.slice(0, 3).map((p) => p.fullName).join(', ')}
                  {s.people.length > 3 ? ` +${s.people.length - 3}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
