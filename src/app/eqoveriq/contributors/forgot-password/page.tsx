import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Sparkles } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = {
  title: { absolute: 'EQoverIQ — Reset your password' },
  robots: { index: false, follow: false },
}

export default function EqOverIqContributorForgotPasswordPage() {
  return (
    <PortalAuthCard
      icon={Sparkles}
      portalLabel="EQoverIQ for Contributors"
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <Suspense fallback={null}>
        <ForgotPasswordForm
          loginHref="/eqoveriq/contributors/login"
          postResetHref="/eqoveriq/contributors"
          signupHref="/eqoveriq/contributors/signup"
        />
      </Suspense>
    </PortalAuthCard>
  )
}
