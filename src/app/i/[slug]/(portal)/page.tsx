import { notFound, redirect } from 'next/navigation'
import { getInstitutionAccess } from '@/lib/higher-ed/access'
import { getWorkspace, lockedWorkspacesFor, orgBasePath, orgKindOf, TIER_LABELS } from '@/lib/higher-ed/workspaces'
import { prisma } from '@/lib/prisma'
import { ViewAsForm } from '@/components/higher-ed/ViewAsForm'

// /i/[slug]: straight to the first workspace this person holds (spec §4).
// With none, say so plainly; an nc_admin on a real tenant gets View-as.
export default async function InstitutionRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ denied?: string }>
}) {
  const { slug } = await params
  const { denied } = await searchParams
  const access = await getInstitutionAccess(slug)
  if (access === 'signed-out') redirect(`/i/login?next=${encodeURIComponent(`/i/${slug}`)}`)
  if (!access) notFound()

  const first = access.workspaces[0]
  const deniedLabel = denied ? (getWorkspace(denied)?.label ?? denied) : null
  if (first && !denied) redirect(`${orgBasePath(slug, access.institution.orgType)}/${getWorkspace(first)!.homePath}`)
  // A staff role whose workspaces the college's license doesn't include.
  const inst = first ? null : await prisma.institution.findUnique({ where: { id: access.institution.id }, select: { tier: true } })
  const locked = inst ? lockedWorkspacesFor(access.ownTokens, inst.tier, {}, orgKindOf(access.institution.orgType)) : []

  return (
    <div className="mx-auto max-w-xl space-y-4 py-8">
      {deniedLabel ? (
        <>
          <h1 className="text-xl font-semibold">You don&apos;t have access to {deniedLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {first
              ? 'Use the workspaces on the left. An institution admin can give you this role from Admin › Staff.'
              : `Ask an administrator at ${access.institution.name} to give you a role.`}
          </p>
        </>
      ) : locked.length ? (
        <>
          <h1 className="text-xl font-semibold">{locked.map((w) => w.label).join(' and ')} isn&apos;t in {access.institution.name}&apos;s license yet</h1>
          <p className="text-sm text-muted-foreground">
            Your invite worked. {locked[0].label} comes with the {TIER_LABELS[locked[0].minTier!]} license; once {access.institution.name} upgrades, it opens here
            automatically. Your college admin can ask NextChapter at support@launchyournextchapter.com.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">No workspace at {access.institution.name} yet</h1>
          <p className="text-sm text-muted-foreground">
            {access.via === 'candidate'
              ? `You're signed in to the job-seeker site as ${access.email}, and that login only opens a member's own page here.`
              : `You're signed in as ${access.email}, which doesn't hold a staff role, a membership or an approved employer seat here.`}{' '}
            If you were invited, open the invite link from your email. Otherwise ask an administrator at {access.institution.name}.
          </p>
          {access.via === 'candidate' && (
            <a href={`/i/login?next=${encodeURIComponent(`/i/${slug}`)}`} className="inline-block text-sm font-medium text-primary hover:underline">
              Staff, member companies and NextChapter: sign in to the organization portal
            </a>
          )}
        </>
      )}
      {access.isNcAdmin && !access.institution.isDemo && access.mode !== 'view-as' && <ViewAsForm slug={slug} institutionName={access.institution.name} />}
    </div>
  )
}
