import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Target } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — Reset your password' },
  robots: { index: false, follow: false },
}

export default function CrucibleEmployerForgotPasswordPage() {
  return (
    <PortalAuthCard
      icon={Target}
      portalLabel="noexperienceneeded.ai for Employers"
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <Suspense fallback={null}>
        <ForgotPasswordForm
          loginHref="/noexperience/employers/login"
          postResetHref="/noexperience/employers"
          signupHref="/noexperience/employers/signup"
        />
      </Suspense>
    </PortalAuthCard>
  )
}
