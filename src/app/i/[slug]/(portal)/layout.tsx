import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getInstitutionAccess } from '@/lib/higher-ed/access'
import { demoPersonasFor, orgHostKindOf, labelFor, lockedWorkspacesFor, orgBasePath, orgKindOf, tabsFor, TIER_LABELS, workspaceFeaturesOf, WORKSPACES } from '@/lib/higher-ed/workspaces'
import { modulesFrom } from '@/lib/higher-ed/modules'
import { signOutOrg } from './session-actions'
import { CanonicalOrgUrl } from '@/components/higher-ed/CanonicalOrgUrl'
import { orgKindForHost } from '@/lib/org-hosts'
import { WorkspaceRail, type RailItem } from '@/components/higher-ed/WorkspaceRail'
import { DemoBar } from '@/components/higher-ed/DemoBar'
import { guestLinkToken } from '@/lib/higher-ed/demo-guest'
import { orgAppUrl } from '@/lib/org-hosts'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'
import { signOut } from '@/app/dashboard/actions'
import { PORTAL_TYPES, portalStyle } from '@/lib/partners/portal-types'
import { prisma } from '@/lib/prisma'
import { readProfile } from '@/lib/higher-ed/profile'
import { organizationBrandFor } from '@/lib/organizations/service'
import { PortalHelpLauncher } from '@/components/portal/PortalHelpLauncher'
import { SignOutForm } from '@/components/auth/SignOutForm'
import { PortalTypeBar } from '@/components/partners/PortalTypeBar'

async function getTaglineAndFeatures(institutionId: string) {
  const row = await prisma.institution.findUnique({ where: { id: institutionId }, select: { profile: true, enabledFeatures: true } })
  return { tagline: readProfile(row?.profile).tagline ?? null, features: workspaceFeaturesOf(row?.enabledFeatures), modules: modulesFrom(row?.enabledFeatures), chromeColor: (row?.enabledFeatures as { demo?: { chromeColor?: string } } | null)?.demo?.chromeColor ?? null }
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
    const h = await headers()
    const login = orgKindForHost(h.get('host')) ? '/login' : path.startsWith('/workforce/') ? '/workforce/login' : path.startsWith('/highered/') ? '/highered/login' : '/i/login'
    redirect(`${login}?next=${encodeURIComponent(path)}`)
  }
  if (!access) notFound()

  const { institution } = access
  // An organization that owns this college sets one brand for all its portals; it wins over the college's own.
  const [{ tagline, features, chromeColor, modules }, orgBrand] = await Promise.all([
    getTaglineAndFeatures(institution.id),
    organizationBrandFor('HIGHER_ED', institution.id).catch(() => null),
  ])
  const accent = orgBrand?.accent ?? institution.accentColor ?? '#2e7d5b'
  const logoUrl = orgBrand?.logoUrl ?? institution.logoUrl
  const programName = orgBrand?.name ?? institution.programBrandName
  // The portal look (owner decision, 2026-11-17): the portal's own color and tint on a white page, orange actions. The
  // organization's or college's brand stays the logo and name in the header; it no longer colors buttons or the page.
  const portalType = orgKindOf(institution.orgType) === 'workforce' ? 'workforce' : 'higher_ed'
  const theme = {
    ...portalStyle(portalType),
    '--accent-text': PORTAL_TYPES[portalType].chrome,
  } as CSSProperties

  // Admins also see what a higher tier adds (the upgrade path, product
  // design Packaging); everyone else sees only what they can open.
  const showLocked = access.tokens.has('INSTITUTION_ADMIN')
  const locked = new Set(showLocked ? lockedWorkspacesFor(access.tokens, institution.tier, features, orgKindOf(institution.orgType)).map((w) => w.key) : [])
  const rail: RailItem[] = WORKSPACES.filter(
    (w) => access.workspaces.includes(w.key) || locked.has(w.key) || (w.release === 'V2' && institution.isDemo),
  ).map((w) => ({
    key: w.key,
    label: labelFor(w, orgKindOf(institution.orgType)),
    icon: w.icon,
    href: `${orgBasePath(slug, institution.orgType)}/${w.homePath}`,
    badge: w.release === 'V2' ? 'Coming' : locked.has(w.key) && w.minTier ? `${TIER_LABELS[w.minTier]} tier` : null,
  }))

  // A workforce customer's Talent Hub holds what Exec Ed and the WIOA workspace hold for a college (their screens are tabs
  // there), and the participant and member-company views are previews, not places to work. The rail keeps only the places
  // staff work (owner, 2026-11-17: a "See it as" rail section read as demo scaffolding). On a demo, "Preview as" in the demo
  // bar opens those views; on a real portal they are two links in the header. Anyone who cannot open the hub keeps them.
  const folded = orgKindOf(institution.orgType) === 'workforce' && access.workspaces.includes('hub')
  const previews = folded ? rail.filter((r) => ['candidate', 'employer'].includes(r.key) && !r.badge) : []
  const railItems: RailItem[] = folded ? rail.filter((r) => !['execed', 'workforce', 'candidate', 'employer'].includes(r.key)) : rail
  // Talent Hub opens in the rail into its areas and their pages (owner, 2026-11-17), instead of rows of pills on the page.
  // Same tabs and filters the page uses ([workspace]/[[...tab]]/page.tsx); phones keep the pills.
  // The Business Hub (no areas) lists its pages the same way, one per line.
  if (folded) {
    for (const key of ['hub', 'business', 'education', 'funding', 'partners'] as const) {
      const item = railItems.find((r) => r.key === key)
      if (!item) continue
      const tabs = tabsFor(access.tokens, key, modules, 'workforce').filter((t) => (!t.demoOnly || institution.isDemo) && (!t.from || access.workspaces.includes(t.from.workspace)) && (!t.hideWhenWorkspace || !access.workspaces.includes(t.hideWhenWorkspace)))
      const href = (k: string) => (k === tabs[0]?.key ? item.href : `${item.href}/${k}`)
      const groups = [...new Set(tabs.map((t) => t.group).filter((g): g is string => !!g))]
      item.children = groups.length
        ? groups.map((g) => ({ label: g, pages: tabs.filter((t) => t.group === g).map((t) => ({ label: labelFor(t, 'workforce'), href: href(t.key) })) }))
        : tabs.map((t) => ({ label: labelFor(t, 'workforce'), pages: [{ label: labelFor(t, 'workforce'), href: href(t.key) }] }))
    }
  }

  return (
    <div className="theme-partner theme-portal flex min-h-screen flex-col bg-background" style={theme}>
      <CanonicalOrgUrl slug={slug} base={orgBasePath(slug, institution.orgType)} />
      <PortalTypeBar
        type={portalType}
        chrome={institution.isDemo ? (chromeColor && /^#[0-9a-fA-F]{6}$/.test(chromeColor) ? chromeColor : institution.accentColor ? accent : null) : null}
        use={institution.orgType === 'WORKFORCE_BOARD' ? 'Workforce boards' : institution.orgType === 'ECONOMIC_DEVELOPMENT' ? 'Economic development' : null}
      />
      {institution.isDemo && (
        <DemoBar
          slug={slug}
          guestLink={(access.isNcAdmin || access.mode === 'demo-guest') ? orgAppUrl(slug, orgHostKindOf(institution.orgType), `/guest/${guestLinkToken(slug)}`) : null}
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
            {!institution.isDemo && previews.length > 0 && (
              <span className="hidden items-center gap-3 md:flex">
                <span className="text-muted-foreground">Preview</span>
                {previews.map((p) => (
                  <a key={p.key} href={p.href} className="font-medium text-muted-foreground hover:text-foreground">
                    {p.label}
                  </a>
                ))}
              </span>
            )}
            {access.mode === 'demo-guest' ? (
              <a href="/demo/workforce" className="font-medium text-muted-foreground hover:text-foreground">
                Make another demo
              </a>
            ) : (
              <>
                <span className="hidden text-muted-foreground sm:inline">{access.email}</span>
                <SignOutForm action={access.via === 'org' ? signOutOrg.bind(null, `${orgBasePath(slug, institution.orgType)}`) : signOut}>
                  <button type="submit" className="font-medium text-muted-foreground hover:text-foreground">
                    Sign out
                  </button>
                </SignOutForm>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row">
        {rail.length > 0 && (
          <aside className="border-b border-border lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
            <WorkspaceRail items={railItems} />
          </aside>
        )}
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>

      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        powered by NextChapter
      </footer>
      {access.mode !== 'demo-guest' && <PortalHelpLauncher portal="INSTITUTION" slug={slug} />}
    </div>
  )
}
