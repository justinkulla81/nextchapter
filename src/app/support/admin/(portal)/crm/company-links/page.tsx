import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { buildCompanyIndex, matchNameToCompany } from '@/lib/companies/company-links'
import { keepOrganizationSeparate, linkOrganizationToCompany } from './actions'

export const maxDuration = 60

const PAGE_LIMIT = 100

/**
 * CRM organisations that look like a directory company but aren't an identical
 * name. Identical names are linked automatically (see company-graph-sync); these
 * are the uncertain ones, and a wrong link would merge two real businesses'
 * signals and contacts — so a person decides: link them, or keep them separate
 * (a decision that is remembered, so it is never suggested again).
 */
export default async function CompanyLinksPage() {
  await requireAdmin()

  const [companies, orgs, linkedCount, separateCount] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true, canonicalNameNormalized: true } }),
    prisma.crmOrganization.findMany({
      where: { companyId: null, OR: [{ companyLinkState: null }, { companyLinkState: { not: 'KEPT_SEPARATE' } }] },
      select: { id: true, name: true, website: true },
      orderBy: { name: 'asc' },
    }),
    prisma.crmOrganization.count({ where: { companyId: { not: null } } }),
    prisma.crmOrganization.count({ where: { companyLinkState: 'KEPT_SEPARATE' } }),
  ])

  const index = buildCompanyIndex(companies)
  const suggestions = orgs.flatMap((org) => {
    const m = matchNameToCompany(org.name, index)
    return m.kind === 'close' ? [{ org, candidates: m.candidates }] : []
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Company links</h1>
        <p className="text-muted-foreground">
          Organisations in the CRM that look like a company in the directory but don&apos;t match exactly. Link the
          ones that are the same business; keep the rest separate and they won&apos;t be suggested again.
        </p>
        <p className="text-sm text-muted-foreground">
          {linkedCount.toLocaleString()} organisations linked · {suggestions.length.toLocaleString()} to review ·{' '}
          {separateCount.toLocaleString()} kept separate
        </p>
      </div>

      {suggestions.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Nothing to review right now.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {suggestions.slice(0, PAGE_LIMIT).map(({ org, candidates }) => (
            <div key={org.id} className="space-y-3 p-4">
              <div>
                <p className="font-medium text-foreground">{org.name}</p>
                {org.website && <p className="text-sm text-muted-foreground">{org.website}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {candidates.map((c) => (
                  <form key={c.id} action={linkOrganizationToCompany}>
                    <input type="hidden" name="orgId" value={org.id} />
                    <input type="hidden" name="companyId" value={c.id} />
                    <Button type="submit" size="sm">
                      Link to {c.name}
                    </Button>
                  </form>
                ))}
                <form action={keepOrganizationSeparate}>
                  <input type="hidden" name="orgId" value={org.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Keep separate
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
      {suggestions.length > PAGE_LIMIT && (
        <p className="text-sm text-muted-foreground">
          Showing the first {PAGE_LIMIT} of {suggestions.length.toLocaleString()}. Decide these and the next ones appear.
        </p>
      )}
    </div>
  )
}
