// A college or workforce portal address typed on the main site. With org
// subdomains on, the portal's own links are /<slug>/<workspace>/... on
// workforce. or highered. (src/lib/org-hosts.ts). Typed on the main host they
// 404 (404 alerts, 2026-11-17: /demo-one-louisville-87f7f/hub/regionjobs).
// Send them to /i/<slug>/..., whose layout moves to the org's own host.
// Only when the first segment is not a site route and the second is a portal
// workspace, so no real page is ever redirected.
import { APP_TOP_LEVEL } from '@/lib/app-top-level'
import { WORKSPACES } from '@/lib/higher-ed/workspaces'

const WORKSPACE_PATHS = new Set(WORKSPACES.map((w) => w.homePath))
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function orgPortalPathOnMainSite(pathname: string): string | null {
  const [, slug, workspace] = pathname.split('/')
  if (!slug || !workspace || APP_TOP_LEVEL.has(slug) || !SLUG.test(slug)) return null
  if (!WORKSPACE_PATHS.has(workspace)) return null
  return `/i${pathname}`
}
