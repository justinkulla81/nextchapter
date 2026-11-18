import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { getWorkspace, getWorkspaceByPath, MOVED_TABS, labelFor, officeLabel, officeNamesOf, orgBasePath, orgKindOf, tabsFor, type WorkspaceKey } from '@/lib/higher-ed/workspaces'
import { loadModules } from '@/components/higher-ed/screens-community'
import { LockedFeature } from '@/components/plans/LockedFeature'
import { PLAN_CONTACT_EMAIL, blockedScreen, trialForLock, trialState } from '@/lib/plans/entitlements'
import { ComingIn } from '@/components/higher-ed/ComingIn'
import { COMING_DESCRIPTIONS, WORKSPACE_SCREENS, type ScreenSearchParams } from '@/components/higher-ed/screens'
import { EmployerSiteFrame, ParticipantSiteFrame } from '@/components/higher-ed/SiteFrames'
import { memberCompanyFor } from '@/lib/workforce/company-portal'
import { prisma } from '@/lib/prisma'
import { HubBanner } from '@/components/higher-ed/HubBanner'
import { readProfile } from '@/lib/higher-ed/profile'

// Every workspace under /i/[slug]/<workspace>/<tab> (spec §4). One route,
// driven by the WORKSPACES config, so a new workspace is config plus a
// screen, not a new route tree. requireWorkspace() runs first, every time.
export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; workspace: string; tab?: string[] }>
  searchParams: Promise<ScreenSearchParams>
}) {
  const { slug, workspace, tab } = await params
  const config = getWorkspaceByPath(workspace)
  if (!config || config.release !== 'V1') notFound()

  const ctx = await requireWorkspace(slug, config.key as WorkspaceKey)
  // A page that moved to another section (owner, 2026-11-18): the old address still works. Admin pages moved only for workforce organizations.
  const moved = tab?.length === 1 ? MOVED_TABS[config.key as WorkspaceKey]?.[tab[0]] : undefined
  if (moved && (!moved.orgKind || moved.orgKind === orgKindOf(ctx.institution.orgType))) {
    const qs = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]): [string, string][] => (typeof v === 'string' ? [[k, v]] : []))).toString()
    redirect(`${orgBasePath(slug, ctx.institution.orgType)}/${getWorkspace(moved.workspace)!.homePath}/${moved.tab}${qs ? `?${qs}` : ''}`)
  }
  const kind = orgKindOf(ctx.institution.orgType)
  // A workforce program's staff open the participant and employer views as previews ("See it as"), drawn in the
  // frame of the real site each person uses (src/components/higher-ed/SiteFrames.tsx).
  const framed = kind === 'workforce' && ctx.workspaces.includes('hub') && (config.key === 'candidate' || config.key === 'employer')
  // The college's own name for this office (Admin › Branding), one small read.
  const instRow = await prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { enabledFeatures: true, profile: true } })
  const officeNames = officeNamesOf(instRow?.enabledFeatures)
  const hubHero = readProfile(instRow?.profile).hubHeroes?.[config.key]
  const tabs = tabsFor(ctx.tokens, config.key, await loadModules(ctx.institution.id), kind).filter(
    (t) => (!t.demoOnly || ctx.institution.isDemo) && (!t.from || ctx.workspaces.includes(t.from.workspace)) && (t.key !== 'groups' || framed) && (!t.hideWhenWorkspace || !ctx.workspaces.includes(t.hideWhenWorkspace)) && (!t.institutionOnly || !ctx.units?.length),
  )
  const activeKey = tab?.[0] ?? tabs[0]?.key
  const active = tabs.find((t) => t.key === activeKey)
  if (!active || (tab && tab.length > 1)) notFound()

  const Screen = WORKSPACE_SCREENS[`${config.key}:${active.key}`]
  // The free plan locks reporting, the CRM exchange, the activity log and WIOA reporting.
  const locked = blockedScreen(active.from ? `${active.from.workspace}:${active.from.tab}` : `${config.key}:${active.key}`, ctx.institution.plan)
  const base = `${orgBasePath(slug, ctx.institution.orgType)}/${config.homePath}`

  const screen = locked ? (
    <LockedFeature feature={locked} slug={slug} plan={ctx.institution.plan} trial={trialForLock(ctx.institution)} />
  ) : Screen ? (
    <Screen ctx={ctx} searchParams={await searchParams} base={base} />
  ) : (
    <ComingIn step={active.comingIn ?? 'a later step'} what={COMING_DESCRIPTIONS[`${config.key}:${active.key}`] ?? active.label} />
  )
  const groupName = ctx.institution.programBrandName ?? ctx.institution.name
  const trial = trialState(ctx.institution.storedPlan ?? ctx.institution.plan, ctx.institution.trialStartedAt, ctx.institution.trialEndsAt)
  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{officeLabel(config, kind, officeNames)}</h1>
      {trial.state === 'active' && (
        <a
          href={`mailto:${PLAN_CONTACT_EMAIL}?subject=${encodeURIComponent(`Keep the paid plan for ${slug}`)}`}
          className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/15"
        >
          Free trial: {trial.daysLeft} {trial.daysLeft === 1 ? 'day' : 'days'} left. Keep everything
        </a>
      )}
      {ctx.readOnly && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <Eye className="size-3" aria-hidden="true" />
          Read-only
        </span>
      )}
    </div>
  )
  if (framed) {
    const frameTabs = tabs.map((t) => ({ key: t.key, label: labelFor(t, kind) }))
    if (config.key === 'candidate') {
      const member = ctx.memberId ? await prisma.institutionMember.findUnique({ where: { id: ctx.memberId }, select: { firstName: true } }) : null
      return (
        <div className="space-y-6">
          {header}
          <ParticipantSiteFrame base={base} tabs={frameTabs} active={active.key} firstName={member?.firstName ?? null} groupName={groupName}>
            {screen}
          </ParticipantSiteFrame>
        </div>
      )
    }
    const company = await memberCompanyFor(ctx)
    return (
      <div className="space-y-6">
        {header}
        <EmployerSiteFrame base={base} tabs={frameTabs} active={active.key} companyName={company?.name ?? null} groupName={groupName}>
          {screen}
        </EmployerSiteFrame>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {kind === 'workforce' && ['wfhub', 'business', 'education', 'partnerhub'].includes(config.key) && <HubBanner hub={config.key} title={officeLabel(config, kind, officeNames)} hero={hubHero} />}
      {header}

      {tabs.length > 1 && (() => {
        const groups = [...new Set(tabs.map((t) => t.group).filter((g): g is string => !!g))]
        const hrefOf = (t: (typeof tabs)[number]) => (t.key === tabs[0].key ? base : `${base}/${t.key}`)
        const shown = groups.length > 1 && active.group ? tabs.filter((t) => t.group === active.group) : tabs
        const link = (isActive: boolean) =>
          cn('-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors', isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')
        return (
          // Talent Hub's areas and pages are in the left rail on wide screens (WorkspaceRail); phones keep these rows.
          <div className={cn('space-y-3', ['hub', 'business', 'education', 'wfhub', 'partnerhub'].includes(config.key) && kind === 'workforce' && 'lg:hidden')}>
            {groups.length > 1 && (
              <nav aria-label={`${officeLabel(config, kind, officeNames)} areas`} className="flex flex-wrap gap-2">
                {groups.map((g) => {
                  const first = tabs.find((t) => t.group === g)!
                  const isActive = g === active.group
                  return (
                    <Link
                      key={g}
                      href={hrefOf(first)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn('rounded-full px-3 py-1.5 text-sm font-medium transition-colors', isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70')}
                    >
                      {g}
                    </Link>
                  )
                })}
              </nav>
            )}
            {shown.length > 1 && (
              <nav aria-label={`${officeLabel(config, kind, officeNames)} sections`} className="flex gap-1 overflow-x-auto border-b border-border">
                {shown.map((t) => (
                  <Link key={t.key} href={hrefOf(t)} aria-current={t.key === active.key ? 'page' : undefined} className={link(t.key === active.key)}>
                    {labelFor(t, kind)}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        )
      })()}

      {screen}
    </div>
  )
}
