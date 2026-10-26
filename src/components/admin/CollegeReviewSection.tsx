import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SectionTitle } from '@/components/admin/Collapsible'
import { SubmitButton } from '@/components/ui/submit-button'
import { REVIEW_BATCH, REVIEW_GROUPS, type ReviewGroup } from '@/lib/workforce/college-org-link'
import { addCollegeAsNewOrg, addCollegeGroupAsNewOrgs, linkCollegeToSuggestedOrg } from '@/app/support/admin/(portal)/crm/needs-completion/college-actions'

/** Review List: colleges whose name or website is close to an organization already in the CRM. A person decides. */
export async function CollegeReviewSection() {
  // The table arrives with prisma/manual/2026-10-25-college-org-link.sql; until then there is nothing to show.
  const rows = await prisma.collegeOrgLink.findMany({ where: { matchStatus: 'REVIEW', reviewOrgId: { not: null } }, orderBy: { unitid: 'asc' }, take: 100 }).catch(() => [])
  if (rows.length === 0) return null
  const groups = await Promise.all(
    (Object.keys(REVIEW_GROUPS) as ReviewGroup[]).map(async (g) => ({
      g,
      n: await prisma.collegeOrgLink.count({ where: { matchStatus: 'REVIEW', reviewReason: { startsWith: REVIEW_GROUPS[g].prefix } } }).catch(() => 0),
    })),
  )
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
      {groups.some((x) => x.n > 0) && (
        <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm text-muted-foreground">
            Most of these are colleges that share a website with a sister campus, or whose name only starts like a shorter one. If you have looked at a few and they are different colleges, settle a batch at once; each click adds {REVIEW_BATCH} as their own organizations.
          </p>
          <div className="flex flex-wrap gap-2">
            {groups.filter((x) => x.n > 0).map((x) => (
              <form key={x.g} action={addCollegeGroupAsNewOrgs.bind(null, x.g)}>
                <SubmitButton size="sm" variant="outline" pendingLabel="Adding…">
                  {`Add ${Math.min(REVIEW_BATCH, x.n)} of ${x.n} as new: ${REVIEW_GROUPS[x.g].label}`}
                </SubmitButton>
              </form>
            ))}
          </div>
        </div>
      )}
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
