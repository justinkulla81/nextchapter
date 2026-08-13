import type { AlumniNetworkGroup } from '@prisma/client'
import { ChevronDown } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAlumniGroup, updateAlumniGroup, toggleAlumniGroupActive, deleteAlumniGroup } from './actions'
import { AlumniGroupForm } from '@/components/admin/AlumniGroupForm'
import { ConfirmForm } from '@/components/admin/ConfirmForm'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

function GroupCard({ group }: { group: AlumniNetworkGroup }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {group.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- admin-provided external URL
              <img src={group.logoUrl} alt="" className="mt-0.5 size-8 shrink-0 rounded object-contain" />
            )}
            <div>
              <p className="font-medium">
                {group.name}
                {!group.isActive && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Inactive
                  </span>
                )}
                <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  {group.matchType === 'EMPLOYER' ? 'Employer' : 'School'}
                </span>
              </p>
              {group.description && <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Keywords: {group.keywords.join(', ')}</p>
              <a
                href={group.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-xs text-primary underline underline-offset-4"
              >
                {group.url}
              </a>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <form action={toggleAlumniGroupActive.bind(null, group.id, group.isActive)}>
              <SubmitButton variant="ghost" size="sm">
                {group.isActive ? 'Deactivate' : 'Activate'}
              </SubmitButton>
            </form>
            <ConfirmForm
              action={deleteAlumniGroup.bind(null, group.id)}
              confirmMessage={`Delete "${group.name}"? This can't be undone.`}
            >
              <SubmitButton variant="ghost" size="sm">
                Delete
              </SubmitButton>
            </ConfirmForm>
          </div>
        </div>
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand">
            Edit
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3">
            <AlumniGroupForm action={updateAlumniGroup.bind(null, group.id)} existing={group} />
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

export default async function AlumniGroupsAdminPage() {
  await requireAdmin()

  const groups = await prisma.alumniNetworkGroup.findMany({
    orderBy: [{ matchType: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })
  const employerGroups = groups.filter((g) => g.matchType === 'EMPLOYER')
  const schoolGroups = groups.filter((g) => g.matchType === 'SCHOOL')

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alumni &amp; Employer Networks</h1>
        <p className="mt-1 text-muted-foreground">
          Hand-maintained — there&apos;s no reliable API for &quot;does this employer/school have an alumni group
          and what&apos;s its real URL,&quot; so this catalog is admin-curated. Matched against a candidate&apos;s
          real work history (Employer) or education (School) on the Network page — see
          getMatchedAlumniGroups().
        </p>
      </div>

      <AlumniGroupForm action={createAlumniGroup} />

      <div className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Employer groups ({employerGroups.length})</h2>
        {employerGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <div className="space-y-3">
            {employerGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight">School groups ({schoolGroups.length})</h2>
        {schoolGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <div className="space-y-3">
            {schoolGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
