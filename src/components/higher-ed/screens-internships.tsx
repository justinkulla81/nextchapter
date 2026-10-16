// Candidate › Internships (and Career Services' view of the same list).
// Owner rule: internships appear only here, in a college's Higher Ed portal —
// never on a member's job board, emails or counts. requireWorkspace() has
// already checked that the viewer is a member (or staff) of this college.

import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { listInternships, parseInternshipFilters } from '@/lib/internships/data'
import { INTERNSHIP_FIELDS, INTERNSHIP_FIELD_LABEL, INTERNSHIP_FIELD_MAJORS, INTERNSHIP_TERMS, INTERNSHIP_TERM_LABEL, type InternshipField, type InternshipTerm } from '@/lib/internships/fields'
import { payBasisLabel } from '@/lib/jobs/work-type'
import { EmptyState } from '@/components/ui/empty-state'
import { Label } from '@/components/ui/label'
import { InternshipLink, InternshipsViewed } from './InternshipTracking'

type Props = { ctx: WorkspaceContext; base: string; searchParams?: Record<string, string | undefined> }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

export async function InternshipsScreen({ ctx, searchParams }: Props) {
  const filters = parseInternshipFilters(searchParams ?? {})
  const { rows, total, states } = await listInternships(ctx.institution.id, filters)
  const filtered = !!(filters.field || filters.state || filters.remote || filters.term)
  const staffView = !ctx.tokens.has('MEMBER')
  const demo = !!ctx.institution.isDemo

  return (
    <div className="space-y-5">
      <InternshipsViewed institutionId={ctx.institution.id} count={total} filters={{ ...filters }} demo={demo} />
      <p className="max-w-2xl text-sm text-muted-foreground">
        {staffView
          ? `Paid, professional internships at US employers, listed for ${ctx.institution.name} students and recent grads. Only your students, alumni and staff see this list.`
          : `Paid, professional internships at US employers, listed for ${ctx.institution.name} students and recent grads. New ones arrive every week.`}
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter internships">
        <div className="space-y-1.5">
          <Label htmlFor="int-field">Field / major</Label>
          <select id="int-field" name="field" defaultValue={filters.field ?? ''} className={selectClass}>
            <option value="">Any field</option>
            {INTERNSHIP_FIELDS.map((f) => (
              <option key={f} value={f}>
                {INTERNSHIP_FIELD_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="int-term">Term</Label>
          <select id="int-term" name="term" defaultValue={filters.term ?? ''} className={selectClass}>
            <option value="">Any term</option>
            {INTERNSHIP_TERMS.map((t) => (
              <option key={t} value={t}>
                {INTERNSHIP_TERM_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="int-state">State</Label>
          <select id="int-state" name="state" defaultValue={filters.state ?? ''} className={selectClass}>
            <option value="">Anywhere in the US</option>
            {states.map((s) => (
              <option key={s.state} value={s.state}>
                {s.state} ({s.count})
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="remote" value="1" defaultChecked={!!filters.remote} className="size-4" />
          Remote only
        </label>
        <button type="submit" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Show internships
        </button>
        {filtered && (
          <Link href="?" className="text-sm text-muted-foreground underline">
            Clear
          </Link>
        )}
      </form>
      {filters.field && <p className="text-xs text-muted-foreground">Suits: {INTERNSHIP_FIELD_MAJORS[filters.field]}.</p>}

      {rows.length ? (
        <>
          <p className="text-sm text-muted-foreground">
            {total > rows.length ? `Showing ${rows.length} of ${total.toLocaleString()} internships. Narrow by field or state to see the rest.` : `${total.toLocaleString()} ${total === 1 ? 'internship' : 'internships'}.`}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {rows.map((r) => {
              const pay = payBasisLabel({ title: r.title, salaryMin: r.salaryMin, salaryMax: r.salaryMax, payPeriod: r.payPeriod, workType: 'internship' })
              const term = r.term ? `${INTERNSHIP_TERM_LABEL[r.term as InternshipTerm] ?? r.term}${r.termYear ? ` ${r.termYear}` : ''}` : null
              const facts = [r.field ? INTERNSHIP_FIELD_LABEL[r.field as InternshipField] : null, term, pay, r.deadline ? `Apply by ${dateFmt.format(r.deadline)}` : null].filter(Boolean)
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {r.title}
                      {r.institutionId && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Only at {ctx.institution.name}</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">{[r.companyName, r.remote ? (r.location ? `${r.location} · Remote` : 'Remote') : r.location].filter(Boolean).join(' · ')}</p>
                    {facts.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{facts.join(' · ')}</p>}
                  </div>
                  <InternshipLink institutionId={ctx.institution.id} jobId={r.id} href={r.url} demo={demo}>
                    View posting
                  </InternshipLink>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title={filtered ? 'No internships match these filters' : 'No internships listed yet'}
          description={filtered ? 'Try another field or state, or clear the filters.' : 'Internships from US employers arrive here every week. Check back soon.'}
        />
      )}
    </div>
  )
}
