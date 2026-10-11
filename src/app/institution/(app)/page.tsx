import Link from 'next/link'
import { getCurrentInstitutionUser } from '@/lib/institution/auth'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { ROLE_LABEL } from '@/lib/institution/permissions'
import { readBranding } from '@/lib/institution/branding'

export default async function InstitutionHomePage() {
  const user = await getCurrentInstitutionUser()
  const inst = await prisma.institution.findUniqueOrThrow({
    where: { id: user.institutionId },
    select: { accentColor: true, logoUrl: true, profile: true },
  })
  const brand = readBranding(inst)
  const [claimed, jobs, targets] = await Promise.all([
    prisma.institutionMember.count({
      where: { institutionId: user.institutionId, status: { in: ['CLAIMED', 'ACTIVE'] } },
    }),
    prisma.exclusiveJobPosting.count({
      where: { institutionScopeId: user.institutionId, archivedAt: null, status: { in: ['approved', 'pending'] } },
    }),
    prisma.institutionTargetCompany.count({ where: { institutionId: user.institutionId } }),
  ])

  return (
    <div className="space-y-6">
      {brand.heroImageUrl && (
        <div className="relative overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.heroImageUrl} alt="" className="h-48 w-full object-cover" />
          {brand.tagline && (
            <p className="absolute inset-x-0 bottom-0 bg-black/50 px-4 py-2 text-sm font-medium text-white">{brand.tagline}</p>
          )}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{user.institutionName}</h1>
        <p className="text-muted-foreground">
          Signed in as {user.fullName ?? user.email}, {ROLE_LABEL[user.role]}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Alumni on NextChapter</p>
          <p className="mt-1 text-2xl font-semibold">{claimed < MIN_CELL_SIZE ? `Fewer than ${MIN_CELL_SIZE}` : claimed.toLocaleString()}</p>
        </div>
        <Link href="/institution/jobs" className="rounded-lg border border-border p-4 hover:border-primary">
          <p className="text-sm text-muted-foreground">Alumni-only jobs</p>
          <p className="mt-1 text-2xl font-semibold">{jobs}</p>
        </Link>
        <Link href="/institution/companies" className="rounded-lg border border-border p-4 hover:border-primary">
          <p className="text-sm text-muted-foreground">Target companies</p>
          <p className="mt-1 text-2xl font-semibold">{targets}</p>
        </Link>
      </div>
    </div>
  )
}
