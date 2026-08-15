import { getRoleGrants } from '@/lib/auth/role-grants'
import { switchRole } from '@/lib/auth/switch-role'
import { SwitchRoleSubmitButton } from './SwitchRoleSubmitButton'
import type { RoleGrantRole } from '@prisma/client'

// Partners Master Build Script §B4 — "Required whenever an identity holds
// more than one role grant." Server-resolved and rendered before hydration
// (§B8/§E4 item 10 — "no flash of the wrong role") since this is itself a
// Server Component with no client-side role resolution step. Persistent,
// never dismissible — there is deliberately no close/hide affordance here.
//
// Visual polish is intentionally basic this phase — Part B's full partner
// design system (navy top-bar chrome, per-surface accent colors) is Phase
// 2's job. This phase is the logic: does the banner appear exactly when it
// should, does it name the current role, does switching force real re-auth.

const ROLE_LABEL: Record<RoleGrantRole, string> = {
  candidate: 'Candidate',
  alum: 'Alum',
  member: 'Member',
  coach: 'Coach',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring Manager',
  employer_admin: 'Employer',
  employer_viewer: 'Employer',
  nc_admin: 'Admin',
}

// Only roles with a real, distinct portal today are offered as a switch
// target — the other role labels above (alum/member/hiring_manager/
// employer_*) can still show as "you also hold this role" context in a
// future pass, but there's nowhere for "Switch to →" to send them yet (see
// PORTAL_LOGIN_PATH in src/lib/auth/switch-role.ts).
const SWITCHABLE_ROLES: RoleGrantRole[] = ['candidate', 'coach', 'recruiter', 'nc_admin']

export async function RoleContextBanner({
  userId,
  currentRole,
  personName,
  accountName,
}: {
  userId: string
  currentRole: RoleGrantRole
  personName: string
  // Employer-side account naming per spec §B4 ("You're in Employer view —
  // Meridian Health") — accepted here so the shape is ready, but nothing
  // passes it yet since the employer portal itself is Phase 5.
  accountName?: string
}) {
  const roles = await getRoleGrants(userId)
  if (roles.length < 2) return null

  const switchTargets = roles.filter((role) => role !== currentRole && SWITCHABLE_ROLES.includes(role))
  if (switchTargets.length === 0) return null

  const currentLabel = ROLE_LABEL[currentRole] ?? currentRole

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-navy px-6 py-2 text-sm text-white">
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
