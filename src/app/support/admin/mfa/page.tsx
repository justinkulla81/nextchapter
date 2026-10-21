import { ShieldCheck } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { TwoStepLogin } from '@/components/admin/TwoStepLogin'
import { requireAdminSession } from '@/lib/admin/auth'
import { adminMfaRequired } from '@/lib/admin/mfa'
import { safeNext } from '@/lib/auth/safe-next'
import { createClient } from '@/lib/supabase/server'
import { NOINDEX } from '@/lib/seo/canonical'
import { factorRows } from '@/lib/admin/mfa-factors'

export const metadata = NOINDEX

// Admin two-step login: set up an authenticator, enter its code, or manage
// authenticators. Outside the (portal) group on purpose: that layout calls
// requireAdmin, which sends an aal1 session here, so it must not wrap this page.
export default async function AdminTwoStepPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { user, aal } = await requireAdminSession()
  const { next } = await searchParams
  const supabase = await createClient('admin')
  const { data } = await supabase.auth.mfa.listFactors()
  const target = safeNext(next, '/support/admin')
  return (
    <PortalAuthCard icon={ShieldCheck} portalLabel="Admin" title="Two-step login" description="Your password, then a code from your phone.">
      <TwoStepLogin
        portal="admin"
        email={user.email ?? ''}
        verified={aal === 'aal2'}
        factors={factorRows(data?.totp ?? [])}
        required={adminMfaRequired()}
        next={target.startsWith('/support/admin/mfa') ? '/support/admin' : target}
      />
    </PortalAuthCard>
  )
}
