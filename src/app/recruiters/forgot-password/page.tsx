import { Suspense } from 'react'
import { Users } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function RecruiterForgotPasswordPage() {
  return (
    <PortalAuthCard
      icon={Users}
      portalLabel="Recruiters"
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <Suspense fallback={null}>
        <ForgotPasswordForm
          loginHref="/recruiters/login"
          postResetHref="/recruiters/dashboard"
          signupHref="/recruiters/signup"
        />
      </Suspense>
    </PortalAuthCard>
  )
}
