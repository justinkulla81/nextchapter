import 'server-only'
import { getEmployerAccess } from '@/lib/employer/access'
import { switcherItems } from '@/lib/employer/section-links'
import { urlForAppPath } from '@/lib/portal-hosts'
import type { EmployerSectionKey } from '@/lib/employer/sections'

// The links in the top bar's section switcher, for a signed-in person. Fail soft: this only decorates the page, so any error
// (a table not applied yet, a timeout) returns no links and the page renders exactly as it did before.

export interface SwitcherLink {
  key: EmployerSectionKey
  label: string
  href: string
}

export async function employerSwitcherLinks(userId: string, email: string | null): Promise<SwitcherLink[]> {
  try {
    const access = await getEmployerAccess({ userId, email })
    return switcherItems(access).map((i) => ({ key: i.key, label: i.label, href: urlForAppPath(i.appPath) }))
  } catch {
    return []
  }
}
