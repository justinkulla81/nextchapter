import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { getWorkspace, labelFor, orgKindOf, tabsFor, type WorkspaceKey } from '@/lib/higher-ed/workspaces'
import { loadModules } from '@/components/higher-ed/screens-community'
import { ComingIn } from '@/components/higher-ed/ComingIn'
import { COMING_DESCRIPTIONS, WORKSPACE_SCREENS, type ScreenSearchParams } from '@/components/higher-ed/screens'

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
  const config = getWorkspace(workspace)
  if (!config || config.release !== 'V1') notFound()

  const ctx = await requireWorkspace(slug, config.key as WorkspaceKey)
  const kind = orgKindOf(ctx.institution.orgType)
  const tabs = tabsFor(ctx.tokens, config.key, await loadModules(ctx.institution.id), kind)
  const activeKey = tab?.[0] ?? tabs[0]?.key
  const active = tabs.find((t) => t.key === activeKey)
  if (!active || (tab && tab.length > 1)) notFound()

  const Screen = WORKSPACE_SCREENS[`${config.key}:${active.key}`]
  const base = `/i/${slug}/${config.homePath}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{labelFor(config, kind)}</h1>
        {ctx.readOnly && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <Eye className="size-3" aria-hidden="true" />
            Read-only
          </span>
        )}
      </div>

      {tabs.length > 1 && (
        <nav aria-label={`${labelFor(config, kind)} sections`} className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t, i) => {
            const href = i === 0 ? base : `${base}/${t.key}`
            const isActive = t.key === active.key
            return (
              <Link
                key={t.key}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {labelFor(t, kind)}
              </Link>
            )
          })}
        </nav>
      )}

      {Screen ? (
        <Screen ctx={ctx} searchParams={await searchParams} base={base} />
      ) : (
        <ComingIn step={active.comingIn ?? 'a later step'} what={COMING_DESCRIPTIONS[`${config.key}:${active.key}`] ?? active.label} />
      )}
    </div>
  )
}
