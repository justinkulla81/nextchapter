import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { ttlCached } from '@/lib/admin/ttl-cache'
import { findAbbreviationSuggestions, MIN_SQUASHED_LENGTH } from '@/lib/companies/company-duplicates'
import { decidedAliasPairs } from '@/lib/companies/company-alias'
import { MergeGroupActions, AbbreviationActions, AliasForm } from '@/components/admin/CrmDuplicateActions'

export const maxDuration = 60

const PAGE_LIMIT = 100

// Building the initials index reads every company name, which only changes as the
// directory grows.
const getAbbreviationSuggestions = ttlCached(10 * 60 * 1000, async () =>
  findAbbreviationSuggestions(
    await prisma.company.findMany({ select: { id: true, name: true, canonicalNameNormalized: true } }),
  ),
)
/** Names this short ("BA" vs "B&A") are as likely to be two companies as one. */
const SHORT_NAME = 6

/**
 * Organizations whose names are the same letters once spacing, punctuation and
 * "&" are ignored ("JP Morgan Chase" / "JPMorgan Chase"). Merging asks for
 * confirmation. Abbreviations ("AWS" / "Amazon Web Services") aren't
 * found by this list; those are suggested for review when a company is added.
 */
export default async function DuplicateOrganizationsPage() {
  const admin = await requireAdmin()
  const [allSuggestions, decided] = await Promise.all([getAbbreviationSuggestions(), decidedAliasPairs()])
  const abbreviations = allSuggestions.filter((a) => !decided.has(`${a.abbreviation.canonicalNameNormalized}|${a.fullName.id}`))

  const groups = await prisma.$queryRaw<{ squashed: string; ids: string[] }[]>`
    SELECT regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g') AS squashed, array_agg(id) AS ids
      FROM "CrmOrganization"
     GROUP BY 1
    HAVING count(*) > 1`
  const orgs = await prisma.crmOrganization.findMany({
    where: { id: { in: groups.flatMap((g) => g.ids) } },
    select: {
      id: true, name: true, companyId: true, hiringClient: true, createdAt: true,
      _count: { select: { affiliations: true, opportunities: true, mandates: true } },
    },
  })
  const byId = new Map(orgs.map((o) => [o.id, o]))

  // The directory companies behind them can be duplicated too (the same letters, 6+ of them).
  const companyGroups = await prisma.$queryRaw<{ ids: string[] }[]>`
    SELECT array_agg(id) AS ids
      FROM "Company"
     WHERE length(regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g')) >= ${MIN_SQUASHED_LENGTH}
     GROUP BY regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g')
    HAVING count(*) > 1`
  const companyIds = companyGroups.flatMap((g) => g.ids)
  const [companies, boardCounts, openingCounts] = await Promise.all([
    prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }),
    prisma.exclusiveJobPosting.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds } }, _count: { _all: true } }),
    prisma.companyJobOpening.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds } }, _count: { _all: true } }),
  ])
  const companyById = new Map(companies.map((c) => [c.id, c]))
  const jobsOf = new Map<string, number>()
  for (const r of [...boardCounts, ...openingCounts]) if (r.companyId) jobsOf.set(r.companyId, (jobsOf.get(r.companyId) ?? 0) + r._count._all)
  const companyRows = companyGroups
    .map((g) => ({
      members: g.ids.flatMap((id) => (companyById.has(id) ? [companyById.get(id)!] : [])).sort((a, b) => (jobsOf.get(b.id) ?? 0) - (jobsOf.get(a.id) ?? 0)),
    }))
    .sort((a, b) => a.members[0].name.localeCompare(b.members[0].name))
  const weight = (o: { _count: { affiliations: number; opportunities: number; mandates: number } }) =>
    o._count.affiliations + o._count.opportunities + o._count.mandates
  const rows = groups
    .map((g) => ({
      squashed: g.squashed,
      short: g.squashed.length < SHORT_NAME,
      members: g.ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])).sort((a, b) => weight(b) - weight(a)),
    }))
    .map((g) => ({ ...g, activity: g.members.reduce((n, o) => n + weight(o), 0) }))
    .sort((a, b) => b.activity - a.activity || a.squashed.localeCompare(b.squashed))

  captureServerEvent(admin.email ?? 'admin', 'crm_duplicates_viewed', {
    groups: rows.length, companyGroups: companyRows.length, abbreviationSuggestions: abbreviations.length, shortNameGroups: rows.filter((r) => r.short).length,
  })

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Duplicate organizations</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Organizations whose names differ only by spacing, punctuation or &quot;&amp;&quot;. Groups with people or deals
          attached are first. Pick the record to keep and the others merge into it. Companies and abbreviations are below.
        </p>
        <p className="text-sm text-muted-foreground">
          {rows.length.toLocaleString()} groups · {rows.filter((r) => r.short).length.toLocaleString()} with very short names, which may be different companies
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No duplicate names found.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.slice(0, PAGE_LIMIT).map((g) => (
            <li key={g.squashed} className="space-y-1 p-3 text-sm">
              {g.short && <p className="text-xs text-muted-foreground">Very short name: check these are the same company.</p>}
              {g.members.map((o) => (
                <p key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/support/admin/crm/organizations/${o.id}`} className="font-medium hover:underline">{o.name}</Link>
                  <span className="text-xs text-muted-foreground">
                    {o._count.affiliations} people · {o._count.opportunities} deals · {o._count.mandates} mandates
                    {o.hiringClient ? ' · hiring client' : ''}
                    {o.companyId ? '' : ' · not linked to a company'}
                  </span>
                </p>
              ))}
              <MergeGroupActions members={g.members.map((o) => ({ id: o.id, name: o.name }))} />
            </li>
          ))}
        </ul>
      )}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Duplicate companies ({companyRows.length.toLocaleString()})</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          The directory companies behind job postings and resumes, with names that are the same letters. Merging moves postings, resumes, intel and
          CRM records to the one you keep, and the other name keeps resolving to it.
        </p>
        {companyRows.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No duplicate companies found.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {companyRows.slice(0, PAGE_LIMIT).map((g) => (
              <li key={g.members.map((m) => m.id).join('-')} className="space-y-1 p-3 text-sm">
                {g.members.map((c) => (
                  <p key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{(jobsOf.get(c.id) ?? 0).toLocaleString()} postings</span>
                  </p>
                ))}
                <MergeGroupActions kind="company" members={g.members.map((c) => ({ id: c.id, name: c.name }))} />
              </li>
            ))}
          </ul>
        )}
        {companyRows.length > PAGE_LIMIT && (
          <p className="text-sm text-muted-foreground">Showing the first {PAGE_LIMIT} of {companyRows.length.toLocaleString()} groups.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Add an alias by hand</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          For renames and abbreviations the suggestions can&apos;t find, like Rtx and Raytheon. If a company already exists under the left name it is
          merged into the one on the right; otherwise future resumes and postings with that name resolve to it.
        </p>
        <AliasForm />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Possible abbreviations ({abbreviations.length.toLocaleString()})</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          A company whose whole name is the initials of another (&quot;AWS&quot; and &quot;Amazon Web Services&quot;). Nothing happens until
          you confirm, because an acronym can belong to more than one company.
        </p>
        {abbreviations.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No abbreviation matches found.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {abbreviations.slice(0, PAGE_LIMIT).map((a) => (
              <li key={`${a.abbreviation.id}-${a.fullName.id}`} className="p-3 text-sm">
                <span className="font-medium">{a.abbreviation.name}</span>
                <span className="text-muted-foreground"> may be </span>
                <span className="font-medium">{a.fullName.name}</span>
                <div className="mt-1">
                  <AbbreviationActions
                    abbreviation={{ id: a.abbreviation.id, name: a.abbreviation.name }}
                    full={{ id: a.fullName.id, name: a.fullName.name }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {rows.length > PAGE_LIMIT && (
        <p className="text-sm text-muted-foreground">Showing the first {PAGE_LIMIT} of {rows.length.toLocaleString()} groups.</p>
      )}
    </div>
  )
}
