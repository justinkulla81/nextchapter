import { Suspense } from 'react'
import { GraduationCap } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { NOINDEX } from '@/lib/seo/canonical'

export const metadata = NOINDEX

export default function InstitutionForgotPasswordPage() {
  return (
    <PortalAuthCard
      icon={GraduationCap}
      portalLabel="Colleges"
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <Suspense fallback={null}>
        <ForgotPasswordForm loginHref="/institution/login" postResetHref="/institution" signupHref={null} />
      </Suspense>
    </PortalAuthCard>
  )
}
