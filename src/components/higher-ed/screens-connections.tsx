// Admin › Connected organizations: this portal's connections with other portals (src/lib/connections). Every kind of organization.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { connectionsFor } from '@/lib/connections/connections'
import { ConnectionsPanel } from '@/components/connections/ConnectionsPanel'
import { decideConnectionAction, endConnectionAction, requestConnectionAction, setSharesAction } from '@/app/i/[slug]/(portal)/connection-actions'

type Props = { ctx: WorkspaceContext; base: string; searchParams: Record<string, string | undefined> }

export async function AdminConnections({ ctx, searchParams }: Props) {
  const slug = ctx.institution.slug
  const q = searchParams.q?.trim() ?? ''
  const data = await connectionsFor({ kind: 'INSTITUTION', id: ctx.institution.id }, q)
  if (!data) return <p className="text-sm text-muted-foreground">This portal could not be loaded. Reload the page.</p>
  return (
    <ConnectionsPanel
      data={data}
      q={q}
      canEdit={!ctx.readOnly}
      actions={{
        request: requestConnectionAction.bind(null, slug),
        decide: decideConnectionAction.bind(null, slug),
        shares: setSharesAction.bind(null, slug),
        end: endConnectionAction.bind(null, slug),
      }}
    />
  )
}
