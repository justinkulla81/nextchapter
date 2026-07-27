import { Suspense } from 'react'
import { HeartHandshake } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function CoachForgotPasswordPage() {
  return (
    <PortalAuthCard
      icon={HeartHandshake}
      portalLabel="Coaches"
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <Suspense fallback={null}>
        <ForgotPasswordForm
          loginHref="/support/coach/login"
          postResetHref="/support/coach"
          signupHref="/support/coach/signup"
        />
      </Suspense>
    </PortalAuthCard>
  )
}
