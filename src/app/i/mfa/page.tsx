import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { TwoStepLogin } from '@/components/admin/TwoStepLogin'
import { adminMfaRequired } from '@/lib/admin/mfa'
import { factorRows } from '@/lib/admin/mfa-factors'
import { safeNext } from '@/lib/auth/safe-next'
import { createClient } from '@/lib/supabase/server'
import { getOrgUser, getSessionAal } from '@/lib/supabase/get-current-user'
import { NOINDEX } from '@/lib/seo/canonical'

export const metadata = NOINDEX

// Two-step login on the college and workforce portal's own session. A
// NextChapter admin needs it here (with ADMIN_MFA_REQUIRED on) before their
// admin access to every portal applies; see isNcAdmin.
export default async function OrgTwoStepPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getOrgUser()
  if (!user) redirect('/i/login?next=/i/mfa')
  const { next } = await searchParams
  const supabase = await createClient('org')
  const [{ data }, aal] = await Promise.all([supabase.auth.mfa.listFactors(), getSessionAal('org')])
  const target = safeNext(next, '/i/login')
  return (
    <PortalAuthCard icon={ShieldCheck} portalLabel="Colleges and workforce partners" title="Two-step login" description="Your password, then a code from your phone.">
      <TwoStepLogin
        portal="org"
        email={user.email ?? ''}
        verified={aal === 'aal2'}
        factors={factorRows(data?.totp ?? [])}
        required={adminMfaRequired()}
        next={target.startsWith('/i/mfa') ? '/i/login' : target}
      />
    </PortalAuthCard>
  )
}
