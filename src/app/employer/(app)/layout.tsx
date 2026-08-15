import type { Metadata } from 'next'
import type { RoleGrantRole } from '@prisma/client'
import { EmployerNav } from '@/components/employer/EmployerNav'
import { getCurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { RoleContextBanner } from '@/components/auth/RoleContextBanner'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Mirrors ORG_ROLE_TO_GRANT in outplacement-org-users.ts — kept local
// rather than imported since that file is server-only lib code and this is
// the one place a *display* mapping (not an authorization one) is needed.
const ORG_ROLE_TO_GRANT_ROLE: Record<string, RoleGrantRole> = {
  ADMIN: 'employer_admin',
  VIEWER: 'employer_viewer',
  LEGAL: 'employer_legal',
  FINANCE: 'employer_finance',
}

export default async function EmployerAppLayout({ children }: { children: React.ReactNode }) {
  const orgUser = await getCurrentOutplacementOrgUser()

  return (
    <div className="theme-partner min-h-screen">
      <EmployerNav role={orgUser.role} />
      {/* pt-14 clears the fixed top bar — see RecruiterAppLayout's identical comment. */}
      <div className="pt-14">
        <RoleContextBanner
          userId={orgUser.userId}
          currentRole={ORG_ROLE_TO_GRANT_ROLE[orgUser.role]}
          personName={orgUser.fullName ?? 'You'}
          // §B4 — "On the employer side, additionally name the account:
          // 'You're in Employer view — Meridian Health.'"
          accountName={orgUser.orgName}
          className="lg:pl-[calc(16rem+1.5rem)]"
        />
        <main className="px-6 py-12 lg:pl-[calc(16rem+1.5rem)]">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
