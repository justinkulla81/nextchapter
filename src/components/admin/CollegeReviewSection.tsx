import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SectionTitle } from '@/components/admin/Collapsible'
import { SubmitButton } from '@/components/ui/submit-button'
import { addCollegeAsNewOrg, linkCollegeToSuggestedOrg } from '@/app/support/admin/(portal)/crm/needs-completion/college-actions'

/** Review List: colleges whose name or website is close to an organization already in the CRM. A person decides. */
export async function CollegeReviewSection() {
  // The table arrives with prisma/manual/2026-10-25-college-org-link.sql; until then there is nothing to show.
  const rows = await prisma.collegeOrgLink.findMany({ where: { matchStatus: 'REVIEW', reviewOrgId: { not: null } }, orderBy: { unitid: 'asc' }, take: 100 }).catch(() => [])
  if (rows.length === 0) return null
  const [orgs, colleges] = await Promise.all([
    prisma.crmOrganization.findMany({ where: { id: { in: rows.map((r) => r.reviewOrgId!) } }, select: { id: true, name: true } }),
    prisma.collegeProfile.findMany({ where: { unitid: { in: rows.map((r) => r.unitid) } }, select: { unitid: true, name: true, state: true } }),
  ])
  const orgName = new Map(orgs.map((o) => [o.id, o.name]))
  const college = new Map(colleges.map((c) => [c.unitid, c]))
  return (
    <section aria-labelledby="college-matches">
      <SectionTitle id="college-matches" tone="action">Colleges to match</SectionTitle>
      <p className="mt-1 text-sm text-muted-foreground">
        Colleges whose name or website is close to an organization already in the CRM. Link them if they are the same college; otherwise add the college as its own organization.
      </p>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
        {rows.map((r) => (
          <li key={r.unitid} className="space-y-2 px-3 py-2">
            <p className="text-sm">
              <span className="font-medium">{college.get(r.unitid)?.name ?? r.unitid}</span>
              {college.get(r.unitid) && ` (${college.get(r.unitid)!.state})`} — same as{' '}
              <Link href={`/support/admin/crm/organizations/${r.reviewOrgId}`} className="underline">{orgName.get(r.reviewOrgId!) ?? 'an organization'}</Link>?
              {r.reviewReason && <span className="block text-xs text-muted-foreground">{r.reviewReason}</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={linkCollegeToSuggestedOrg.bind(null, r.unitid)}><SubmitButton size="sm" variant="outline" pendingLabel="Linking…">Same college — link</SubmitButton></form>
              <form action={addCollegeAsNewOrg.bind(null, r.unitid)}><SubmitButton size="sm" variant="outline" pendingLabel="Adding…">Different — add as new</SubmitButton></form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
