import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getInstitutionAccess } from '@/lib/higher-ed/access'
import { demoPersonasFor, labelFor, lockedWorkspacesFor, orgBasePath, orgKindOf, TIER_LABELS, WORKSPACES } from '@/lib/higher-ed/workspaces'
import { signOutOrg } from './session-actions'
import { CanonicalOrgUrl } from '@/components/higher-ed/CanonicalOrgUrl'
import { WorkspaceRail, type RailItem } from '@/components/higher-ed/WorkspaceRail'
import { DemoBar } from '@/components/higher-ed/DemoBar'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { signOut } from '@/app/dashboard/actions'
import { readableTextOn } from '@/lib/higher-ed/branding'
import { brandStyle } from '@/lib/partners/brand'
import { prisma } from '@/lib/prisma'
import { readProfile } from '@/lib/higher-ed/profile'
import { organizationBrandFor } from '@/lib/organizations/service'

async function getTagline(institutionId: string): Promise<string | null> {
  const row = await prisma.institution.findUnique({ where: { id: institutionId }, select: { profile: true } })
  return readProfile(row?.profile).tagline ?? null
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The institution portal shell (spec §4): branding from the Institution row,
// the role rail, the demo banner, and the "powered by NextChapter" footer.
// The rail only reflects what requireWorkspace() enforces on every page.
export default async function InstitutionPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const access = await getInstitutionAccess(slug)
  if (access === 'signed-out') {
    // x-pathname is set by the proxy (src/lib/supabase/middleware.ts), so a
    // deep link comes back to the same page after login.
    const path = (await headers()).get('x-pathname') ?? `/i/${slug}`
    const login = path.startsWith('/workforce/') ? '/workforce/login' : path.startsWith('/highered/') ? '/highered/login' : '/i/login'
    redirect(`${login}?next=${encodeURIComponent(path)}`)
  }
  if (!access) notFound()

  const { institution } = access
  const tagline = await getTagline(institution.id)
  // An organization that owns this college sets one brand for all its portals; it wins over the college's own.
  const orgBrand = await organizationBrandFor('HIGHER_ED', institution.id).catch(() => null)
  const accent = orgBrand?.accent ?? institution.accentColor ?? '#2e7d5b'
  const logoUrl = orgBrand?.logoUrl ?? institution.logoUrl
  const programName = orgBrand?.name ?? institution.programBrandName
  // Primary comes from the organization or the college; secondary and background only from the organization.
  const theme = {
    ...(brandStyle({ name: null, logoUrl: null, accent: null, secondary: orgBrand?.secondary, background: orgBrand?.background }) ?? {}),
    '--primary': accent,
    '--primary-foreground': readableTextOn(accent),
    '--ring': accent,
  } as CSSProperties

  // Admins also see what a higher tier adds (the upgrade path, product
  // design Packaging); everyone else sees only what they can open.
  const showLocked = access.tokens.has('INSTITUTION_ADMIN')
  const locked = new Set(showLocked ? lockedWorkspacesFor(access.tokens, institution.tier, {}, orgKindOf(institution.orgType)).map((w) => w.key) : [])
  const rail: RailItem[] = WORKSPACES.filter(
    (w) => access.workspaces.includes(w.key) || locked.has(w.key) || (w.release === 'V2' && institution.isDemo),
  ).map((w) => ({
    key: w.key,
    label: labelFor(w, orgKindOf(institution.orgType)),
    icon: w.icon,
    href: `${orgBasePath(slug, institution.orgType)}/${w.homePath}`,
    badge: w.release === 'V2' ? 'Coming' : locked.has(w.key) && w.minTier ? `${TIER_LABELS[w.minTier]} tier` : null,
  }))

  return (
    <div className="theme-partner flex min-h-screen flex-col bg-background" style={theme}>
      <CanonicalOrgUrl slug={slug} base={orgBasePath(slug, institution.orgType)} />
      {institution.isDemo && (
        <DemoBar
          slug={slug}
          isNcAdmin={access.isNcAdmin}
          guest={access.mode === 'demo-guest'}
          persona={access.demoPersona}
          canReset
          canSkip={orgKindOf(institution.orgType) === 'college'}
          personas={demoPersonasFor(orgKindOf(institution.orgType), institution.tier)}
        />
      )}
      {access.mode === 'view-as' && (
        <div role="status" className="border-b border-sky-300 bg-sky-50 px-4 py-2 text-sm text-sky-950">
          You&apos;re viewing {institution.name} as a NextChapter admin. This session was logged with your reason and ends after an hour.
        </div>
      )}

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <InstitutionMark name={institution.name} logoUrl={logoUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{programName ?? institution.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[programName ? institution.name : null, tagline].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-4 text-sm">
            {access.mode === 'demo-guest' ? (
              <a href="/demo/workforce" className="font-medium text-muted-foreground hover:text-foreground">
                Make another demo
              </a>
            ) : (
              <>
                <span className="hidden text-muted-foreground sm:inline">{access.email}</span>
                <form action={access.via === 'org' ? signOutOrg.bind(null, `${orgBasePath(slug, institution.orgType)}`) : signOut}>
                  <button type="submit" className="font-medium text-muted-foreground hover:text-foreground">
                    Sign out
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row">
        {rail.length > 0 && (
          <aside className="border-b border-border lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
            <WorkspaceRail items={rail} />
          </aside>
        )}
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>

      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        powered by NextChapter
      </footer>
    </div>
  )
}
