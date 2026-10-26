import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireEmployeesRole } from '@/lib/employer/outplacement-auth'
import { INTERNAL_ROLE_STATUS, interestedPeople } from '@/lib/employer/staff-programs'
import { captureServerEvent } from '@/lib/posthog/server'

export const metadata: Metadata = { title: 'Interested in this role' }

// The people who asked to be considered for one internal role. Admins only:
// these are names, which they chose to share by pressing "I'm interested".
export default async function InternalRoleInterestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orgUser = await requireEmployeesRole(['ADMIN'])
  const role = await prisma.exclusiveJobPosting.findFirst({ where: { id, orgScopeId: orgUser.orgId, status: INTERNAL_ROLE_STATUS }, select: { id: true, title: true, location: true, archivedAt: true } })
  if (!role) notFound()
  const people = await interestedPeople(orgUser.orgId, role.id)
  captureServerEvent(orgUser.userId, 'internal_role_interest_viewed', { orgId: orgUser.orgId, postingId: role.id, count: people.length })

  return (
    <div className="space-y-6">
      <Link href="/employer/growth#internal-roles" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Internal roles
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{role.title}</h1>
        <p className="text-sm text-muted-foreground">
          {[role.location, role.archivedAt ? 'Closed' : 'Open'].filter(Boolean).join(' · ')}
        </p>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Each person here pressed “I’m interested” and chose to share their name and email with you for this role. Reach out to them directly. Nothing else about
        their NextChapter activity is shared.
      </p>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody has raised a hand yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {people.map((p) => (
            <li key={p.id} className="space-y-1 p-4">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-muted-foreground">
                {p.email ? (
                  <a className="underline underline-offset-4" href={`mailto:${p.email}?subject=${encodeURIComponent(role.title)}`}>
                    {p.email}
                  </a>
                ) : (
                  'No email on file'
                )}{' '}
                · {p.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
              {p.note && <p className="whitespace-pre-line text-sm">{p.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
