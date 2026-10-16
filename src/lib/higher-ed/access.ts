// Higher Ed request gate: requireWorkspace(), which every /i/[slug] page,
// route handler and server action calls first (spec §4). Hiding a rail item
// is never the protection; this is. Resolution (./resolve.ts) reruns on
// every request, memoized only within one request by React cache().

import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isReadOnlyIn, type WorkspaceKey } from './workspaces'
import { DEMO_PREVIEW_COOKIE, resolveDemoGuestAccess, resolveInstitutionAccess, WorkspaceAccessError, type InstitutionAccess } from './resolve'
import { DEMO_GUEST_COOKIE, guestSlugs } from './demo-guest'

export * from './resolve'

// Request-scoped: the session user, the demo "Preview as" cookie, then
// resolution. Null when signed out or the slug is unknown.
export const getInstitutionAccess = cache(async (slug: string): Promise<InstitutionAccess | null | 'signed-out'> => {
  const user = await getCurrentUser()
  const cookieStore = await cookies()
  if (!user) {
    // A prospect's guest pass to a demo they generated.
    if (guestSlugs(cookieStore.get(DEMO_GUEST_COOKIE)?.value).includes(slug)) {
      const guest = await resolveDemoGuestAccess({ slug, demoPersona: cookieStore.get(DEMO_PREVIEW_COOKIE)?.value ?? null })
      if (guest) return guest
    }
    return 'signed-out'
  }
  return resolveInstitutionAccess({
    slug,
    userId: user.id,
    email: user.email ?? null,
    demoPersona: cookieStore.get(DEMO_PREVIEW_COOKIE)?.value ?? null,
  })
})

export type WorkspaceContext = InstitutionAccess & {
  workspace: WorkspaceKey
  readOnly: boolean
}

// The gate. Call it first in every /i/[slug] page, route handler and server
// action. Signed out → login; unknown slug → 404; no access to this
// workspace → the institution root, which explains what's missing.
// `write: true` additionally refuses a read-only (VIEWER) seat.
export async function requireWorkspace(
  slug: string,
  workspace: WorkspaceKey,
  opts: { write?: boolean } = {},
): Promise<WorkspaceContext> {
  const access = await getInstitutionAccess(slug)
  if (access === 'signed-out') redirect(`/auth/login?next=${encodeURIComponent(`/i/${slug}/${workspace}`)}`)
  if (!access) notFound()
  if (!access.workspaces.includes(workspace)) redirect(`/i/${slug}?denied=${workspace}`)

  const readOnly = access.mode === 'demo-guest' || isReadOnlyIn(access.tokens, workspace)
  if (opts.write && readOnly) {
    throw new WorkspaceAccessError(`Read-only access to ${workspace} at ${slug}`)
  }
  return { ...access, workspace, readOnly }
}

