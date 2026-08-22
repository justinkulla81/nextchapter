import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Target } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirectIfAuthenticated } from '@/lib/auth/redirect-if-authenticated'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — Employer log in' },
  robots: { index: false, follow: false },
}

export default async function CrucibleEmployerLoginPage() {
  await redirectIfAuthenticated('/noexperience/employers')

  return (
    <PortalAuthCard
      icon={Target}
      portalLabel="noexperienceneeded.ai for Employers"
      title="Log in"
      description="Welcome back."
    >
      <Suspense>
        <LoginForm
          defaultNext="/noexperience/employers"
          forgotPasswordHref="/noexperience/employers/forgot-password"
          signupHref="/noexperience/employers/signup"
          showGoogle={false}
        />
      </Suspense>
    </PortalAuthCard>
  )
}
