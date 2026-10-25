import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { ttlCached } from '@/lib/admin/ttl-cache'
import { findAbbreviationSuggestions, MIN_SQUASHED_LENGTH } from '@/lib/companies/company-duplicates'
import { suggestKeeper } from '@/lib/duplicates/suggest'
import { looseKey } from '@/lib/crm/org-duplicates'
import { decidedAliasPairs } from '@/lib/companies/company-alias'
import { DuplicateGroupList, AbbreviationActions, AliasForm } from '@/components/admin/CrmDuplicateActions'
import { SectionTitle } from '@/components/admin/Collapsible'

export const maxDuration = 60

const PAGE_LIMIT = 100

// Building the initials index reads every company name, which only changes as the
// directory grows.
const getAbbreviationSuggestions = ttlCached(10 * 60 * 1000, async () =>
  findAbbreviationSuggestions(
    await prisma.company.findMany({ select: { id: true, name: true, canonicalNameNormalized: true } }),
  ),
)
const getOrganizationNameGroups = ttlCached(5 * 60 * 1000, async () => {
  const all = await prisma.crmOrganization.findMany({ select: { id: true, name: true } })
  const byKey = new Map<string, string[]>()
  for (const o of all) {
    const k = looseKey(o.name)
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), o.id])
  }
  return [...byKey.entries()].filter(([, ids]) => ids.length > 1).map(([squashed, ids]) => ({ squashed, ids }))
})
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
  // Groups an admin dismissed. A missing table reads as "none".
  const dismissed = await prisma.duplicateDismissal.findMany({ select: { kind: true, groupKey: true } })
    .then((r) => new Set(r.map((d) => `${d.kind}|${d.groupKey}`)))
    .catch(() => new Set<string>())
  const abbreviations = allSuggestions.filter((a) => !decided.has(`${a.abbreviation.canonicalNameNormalized}|${a.fullName.id}`))

  // Same company written two ways: spacing, "&", a legal suffix, ".com", a US suffix, an abbreviation in brackets,
  // a site code. Everything the cleanup script (scripts/crm/consolidate-duplicate-orgs.ts) looks for, so a
  // variant that an import creates later shows up here for a one-click merge.
  const groups = await getOrganizationNameGroups()
  const orgs = await prisma.crmOrganization.findMany({
    where: { id: { in: groups.flatMap((g) => g.ids) } },
    select: {
      id: true, name: true, companyId: true, hiringClient: true, createdAt: true,
      _count: { select: { affiliations: true, opportunities: true, mandates: true } },
    },
  })
  const byId = new Map(orgs.map((o) => [o.id, o]))

  // The directory companies behind them can be duplicated too (the same letters, 6+ of them).
  const companyGroups = await prisma.$queryRaw<{ squashed: string; ids: string[] }[]>`
    SELECT regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g') AS squashed, array_agg(id) AS ids
      FROM "Company"
     WHERE length(regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g')) >= ${MIN_SQUASHED_LENGTH}
     GROUP BY regexp_replace("canonicalNameNormalized", '[^a-z0-9]', '', 'g')
    HAVING count(*) > 1`
  const companyIds = companyGroups.flatMap((g) => g.ids)
  const [companies, orgLinks, boardCounts, openingCounts] = await Promise.all([
    prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true, createdAt: true } }),
    prisma.crmOrganization.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds } }, _count: { _all: true } }),
    prisma.exclusiveJobPosting.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds } }, _count: { _all: true } }),
    prisma.companyJobOpening.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds } }, _count: { _all: true } }),
  ])
  const companyById = new Map(companies.map((c) => [c.id, c]))
  const jobsOf = new Map<string, number>()
  for (const r of [...boardCounts, ...openingCounts]) if (r.companyId) jobsOf.set(r.companyId, (jobsOf.get(r.companyId) ?? 0) + r._count._all)
  const hasOrg = new Set(orgLinks.flatMap((r) => (r.companyId ? [r.companyId] : [])))
  const companyRows = companyGroups
    .filter((g) => !dismissed.has(`COMPANY|${g.squashed}`))
    .map((g) => {
      const members = g.ids.flatMap((id) => (companyById.has(id) ? [companyById.get(id)!] : [])).sort((a, b) => (jobsOf.get(b.id) ?? 0) - (jobsOf.get(a.id) ?? 0))
      const keeper = suggestKeeper(members.map((c) => ({ id: c.id, activity: jobsOf.get(c.id) ?? 0, linked: hasOrg.has(c.id), createdAt: c.createdAt })))
      return { squashed: g.squashed, members, keeper }
    })
    .filter((g) => g.members.length > 1)
    .sort((a, b) => a.members[0].name.localeCompare(b.members[0].name))
  const weight = (o: { _count: { affiliations: number; opportunities: number; mandates: number } }) =>
    o._count.affiliations + o._count.opportunities + o._count.mandates
  const rows = groups
    .filter((g) => !dismissed.has(`ORGANIZATION|${g.squashed}`))
    .map((g) => {
      const members = g.ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])).sort((a, b) => weight(b) - weight(a))
      const keeper = suggestKeeper(members.map((o) => ({ id: o.id, activity: weight(o) + (o.hiringClient ? 5 : 0), linked: Boolean(o.companyId), createdAt: o.createdAt })))
      return { squashed: g.squashed, short: g.squashed.length < SHORT_NAME, members, keeper, activity: members.reduce((n, o) => n + weight(o), 0) }
    })
    .filter((g) => g.members.length > 1)
    .sort((a, b) => b.activity - a.activity || a.squashed.localeCompare(b.squashed))

  const reasonFor = (basis: 'activity' | 'linked' | 'oldest', kind: 'organization' | 'company') =>
    basis === 'activity' ? (kind === 'company' ? 'it has the most postings' : 'it has the most people and deals')
    : basis === 'linked' ? 'it is linked to a company record'
    : 'it is the oldest record'

  captureServerEvent(admin.email ?? 'admin', 'crm_duplicates_viewed', {
    groups: rows.length, companyGroups: companyRows.length, abbreviationSuggestions: abbreviations.length, shortNameGroups: rows.filter((r) => r.short).length,
  })

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Duplicate organizations</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Organizations that look like the same company written two ways: spacing, punctuation, &quot;&amp;&quot;, &quot;.com&quot;, a US suffix, an abbreviation in brackets or a site code. Groups with people or deals
          attached are first. The record I&apos;d keep is pre-selected; choose another if you prefer, then merge, or mark the group as not duplicates. Companies and abbreviations are below.
        </p>
        <p className="text-sm text-muted-foreground">
          {rows.length.toLocaleString()} groups · {rows.filter((r) => r.short).length.toLocaleString()} with very short names, which may be different companies
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No duplicate names found.</p>
      ) : (
        <DuplicateGroupList
          kind="organization"
          groups={rows.slice(0, PAGE_LIMIT).map((g) => ({
            groupKey: g.squashed,
            suggestedId: g.keeper.id,
            reason: reasonFor(g.keeper.basis, 'organization'),
            note: g.short ? 'Very short name: check these are the same company.' : undefined,
            members: g.members.map((o) => ({
              id: o.id,
              name: o.name,
              href: `/support/admin/crm/organizations/${o.id}`,
              detail: `${o._count.affiliations} people · ${o._count.opportunities} deals · ${o._count.mandates} mandates${o.hiringClient ? ' · hiring client' : ''}${o.companyId ? '' : ' · not linked to a company'}`,
            })),
          }))}
        />
      )}
      {rows.length > PAGE_LIMIT && (
        <p className="text-sm text-muted-foreground">Showing the first {PAGE_LIMIT} of {rows.length.toLocaleString()} groups.</p>
      )}
      <section className="space-y-2">
        <SectionTitle>Duplicate companies ({companyRows.length.toLocaleString()})</SectionTitle>
        <p className="max-w-prose text-sm text-muted-foreground">
          The directory companies behind job postings and resumes, with names that are the same letters. Merging moves postings, resumes, intel and
          CRM records to the one you keep, and the other name keeps resolving to it.
        </p>
        {companyRows.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No duplicate companies found.</p>
        ) : (
          <DuplicateGroupList
            kind="company"
            groups={companyRows.slice(0, PAGE_LIMIT).map((g) => ({
              groupKey: g.squashed,
              suggestedId: g.keeper.id,
              reason: reasonFor(g.keeper.basis, 'company'),
              members: g.members.map((c) => ({ id: c.id, name: c.name, detail: `${(jobsOf.get(c.id) ?? 0).toLocaleString()} postings` })),
            }))}
          />
        )}
        {companyRows.length > PAGE_LIMIT && (
          <p className="text-sm text-muted-foreground">Showing the first {PAGE_LIMIT} of {companyRows.length.toLocaleString()} groups.</p>
        )}
      </section>

      <section className="space-y-2">
        <SectionTitle>Add an alias by hand</SectionTitle>
        <p className="max-w-prose text-sm text-muted-foreground">
          For renames and abbreviations the suggestions can&apos;t find, like Rtx and Raytheon. If a company already exists under the left name it is
          merged into the one on the right; otherwise future resumes and postings with that name resolve to it.
        </p>
        <AliasForm />
      </section>

      <section className="space-y-2">
        <SectionTitle>Possible abbreviations ({abbreviations.length.toLocaleString()})</SectionTitle>
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
    </div>
  )
}
