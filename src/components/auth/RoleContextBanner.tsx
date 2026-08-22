import { getRoleGrants } from '@/lib/auth/role-grants'
import { switchRole } from '@/lib/auth/switch-role'
import { SwitchRoleSubmitButton } from './SwitchRoleSubmitButton'
import { cn } from '@/lib/utils'
import type { RoleGrantRole } from '@prisma/client'

// Partners Master Build Script §B4 — "Required whenever an identity holds
// more than one role grant." Server-resolved and rendered before hydration
// (§B8/§E4 item 10 — "no flash of the wrong role") since this is itself a
// Server Component with no client-side role resolution step. Persistent,
// never dismissible — there is deliberately no close/hide affordance here.
//
// Phase 2 visual polish: this banner is a plain in-flow block, but every
// caller also renders a `position: fixed` sidebar/top-bar at a higher
// z-index than normal flow content — without an explicit offset, that
// fixed chrome silently paints over this banner's left/top edge (both
// happen to be navy, so it was invisible, but the "Switch to →" button
// could land underneath the sidebar and become unclickable on wide
// viewports). `className` lets each layout pass the same offset its own
// <main> uses, so this banner's content never sits under fixed chrome.

const ROLE_LABEL: Record<RoleGrantRole, string> = {
  candidate: 'Candidate',
  alum: 'Alum',
  member: 'Member',
  coach: 'Coach',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring Manager',
  employer_admin: 'Employer',
  employer_viewer: 'Employer',
  employer_legal: 'Employer',
  employer_finance: 'Employer',
  nc_admin: 'Admin',
  nen_employer: 'NEN Employer',
  eqoveriq_contributor: 'EQoverIQ Contributor',
}

// Only roles with a real, distinct portal today are offered as a switch
// target — the other role labels above (alum/member) can still show as
// "you also hold this role" context in a future pass, but there's nowhere
// for "Switch to →" to send them yet (see PORTAL_LOGIN_PATH in
// src/lib/auth/switch-role.ts). employer_* added in Phase 5, now that
// /employer is a real portal. hiring_manager added in Phase 7, now that
// /hiring is a real portal.
const SWITCHABLE_ROLES: RoleGrantRole[] = [
  'candidate',
  'coach',
  'recruiter',
  'nc_admin',
  'employer_admin',
  'employer_viewer',
  'employer_legal',
  'employer_finance',
  'hiring_manager',
]

export async function RoleContextBanner({
  userId,
  currentRole,
  personName,
  accountName,
  className,
}: {
  userId: string
  currentRole: RoleGrantRole
  personName: string
  // Employer-side account naming per spec §B4 ("You're in Employer view —
  // Meridian Health") — accepted here so the shape is ready, but nothing
  // passes it yet since the employer portal itself is Phase 5.
  accountName?: string
  // Horizontal offset to clear this layout's own fixed sidebar — e.g.
  // `lg:pl-[calc(16rem+1.5rem)]`, matching whatever the caller's own
  // <main> uses. (Vertical clearance for a fixed top bar, where one
  // exists, is handled by the caller wrapping this banner + <main> in a
  // shared `pt-14` div instead — see the partner layouts.) See the
  // comment above for why an offset is necessary at all.
  className?: string
}) {
  const roles = await getRoleGrants(userId)
  if (roles.length < 2) return null

  const switchTargets = roles.filter((role) => role !== currentRole && SWITCHABLE_ROLES.includes(role))
  if (switchTargets.length === 0) return null

  const currentLabel = ROLE_LABEL[currentRole] ?? currentRole

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-navy px-6 py-2 text-sm text-white',
        className
      )}
    >
      <p>
        You&apos;re in <span className="font-semibold">{currentLabel}</span> view.{' '}
        <span className="text-white/70">
          {personName}
          {accountName ? ` · ${accountName}` : ''}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {switchTargets.map((role) => (
          <form key={role} action={switchRole.bind(null, role)}>
            <SwitchRoleSubmitButton label={ROLE_LABEL[role] ?? role} />
          </form>
        ))}
      </div>
    </div>
  )
}
