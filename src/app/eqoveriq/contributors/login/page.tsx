import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Sparkles } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirectIfAuthenticated } from '@/lib/auth/redirect-if-authenticated'

export const metadata: Metadata = {
  title: { absolute: 'EQoverIQ — Contributor log in' },
  robots: { index: false, follow: false },
}

export default async function EqOverIqContributorLoginPage() {
  await redirectIfAuthenticated('/eqoveriq/contributors')

  return (
    <PortalAuthCard icon={Sparkles} portalLabel="EQoverIQ for Contributors" title="Log in" description="Welcome back.">
      <Suspense>
        <LoginForm
          defaultNext="/eqoveriq/contributors"
          forgotPasswordHref="/eqoveriq/contributors/forgot-password"
          signupHref="/eqoveriq/contributors/signup"
          showGoogle={false}
        />
      </Suspense>
    </PortalAuthCard>
  )
}
