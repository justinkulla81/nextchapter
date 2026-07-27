import { Suspense } from 'react'
import { Building2 } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function TalentForgotPasswordPage() {
  return (
    <PortalAuthCard
      icon={Building2}
      portalLabel="Employers"
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <Suspense fallback={null}>
        <ForgotPasswordForm loginHref="/talent/login" postResetHref="/talent" signupHref="/talent/signup" />
      </Suspense>
    </PortalAuthCard>
  )
}
