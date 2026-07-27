import { Suspense } from 'react'
import { ShieldCheck } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function AdminForgotPasswordPage() {
  return (
    <PortalAuthCard
      icon={ShieldCheck}
      portalLabel="Admin"
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <Suspense fallback={null}>
        <ForgotPasswordForm
          loginHref="/support/admin/login"
          postResetHref="/support/admin"
          signupHref={null}
        />
      </Suspense>
    </PortalAuthCard>
  )
}
