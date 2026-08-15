import { Suspense } from 'react'
import { Briefcase } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function HiringManagerForgotPasswordPage() {
  return (
    <PortalAuthCard
      icon={Briefcase}
      portalLabel="Hiring"
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <Suspense fallback={null}>
        <ForgotPasswordForm loginHref="/hiring/login" postResetHref="/hiring/dashboard" signupHref="/hiring/signup" />
      </Suspense>
    </PortalAuthCard>
  )
}
