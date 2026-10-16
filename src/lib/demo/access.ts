import 'server-only'
import type { Organization, OrgWorkspace } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { demoEmail } from './people'
import type { PortalType } from '@/lib/organizations/portals'

// Sign-in to a demo is a one-time link minted by an admin for one sample account.
// There is no shared password, and the sample accounts use a reserved test domain
// so no real mailbox is ever involved.

export interface DemoTarget {
  key: string
  type: PortalType
  label: string
  email: string | null
  /** Where the link lands after sign-in. */
  home: string
}

export function demoTargets(org: Pick<Organization, 'slug'>, workspaces: Array<Pick<OrgWorkspace, 'type' | 'refId'>>): DemoTarget[] {
  const out: DemoTarget[] = []
  for (const w of workspaces) {
    if (!w.refId) continue
    switch (w.type) {
      case 'HIGHER_ED':
        out.push({ key: 'he', type: 'HIGHER_ED', label: 'College portal (demo bar inside)', email: null, home: `/i/${org.slug}` })
        break
      case 'OUTPLACEMENT':
        out.push(
          { key: 'op-admin', type: 'OUTPLACEMENT', label: 'Outplacement, as administrator', email: demoEmail(org.slug, 'op-admin'), home: '/employer' },
          { key: 'op-viewer', type: 'OUTPLACEMENT', label: 'Outplacement, as viewer', email: demoEmail(org.slug, 'op-viewer'), home: '/employer' },
          { key: 'op-finance', type: 'OUTPLACEMENT', label: 'Outplacement, as finance', email: demoEmail(org.slug, 'op-finance'), home: '/employer' },
        )
        break
      case 'COACH':
        out.push({ key: 'coach', type: 'COACH', label: 'Coach', email: demoEmail(org.slug, 'coach'), home: '/support/coach' })
        break
      case 'HIRING':
        out.push({ key: 'hiring', type: 'HIRING', label: 'Hiring team', email: demoEmail(org.slug, 'hiring'), home: '/talent/dashboard' })
        break
      case 'RECRUITER':
        out.push(
          { key: 'rec-admin', type: 'RECRUITER', label: 'Recruiter firm, as admin', email: demoEmail(org.slug, 'rec-admin'), home: '/recruiters/dashboard' },
          { key: 'rec-recruiter', type: 'RECRUITER', label: 'Recruiter firm, as recruiter', email: demoEmail(org.slug, 'rec-recruiter'), home: '/recruiters/dashboard' },
        )
        break
      default:
        break
    }
  }
  return out
}

/** A single-use sign-in link for one sample account of a demo organization. */
export async function createDemoAccessLink(organizationId: string, key: string): Promise<{ url?: string; error?: string }> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, include: { workspaces: true } })
  if (!org) return { error: 'Organization not found.' }
  if (!org.isDemo) return { error: 'Sign-in links are only made for demo organizations.' }
  const target = demoTargets(org, org.workspaces).find((t) => t.key === key)
  if (!target) return { error: 'That role is not part of this demo.' }
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
  if (!target.email) return { url: `${base}${target.home}` }
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
    options: { redirectTo: `${base}/auth/callback?next=${encodeURIComponent(target.home)}` },
  })
  const url = data?.properties?.action_link
  if (error || !url) return { error: 'Could not make a sign-in link. Try again.' }
  return { url }
}
