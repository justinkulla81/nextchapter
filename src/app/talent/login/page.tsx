import { Suspense } from 'react'
import { Building2 } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirectIfAuthenticated } from '@/lib/auth/redirect-if-authenticated'

export default async function TalentLoginPage() {
  await redirectIfAuthenticated('/talent')

  return (
    <PortalAuthCard
      icon={Building2}
      portalLabel="Employers"
      title="Log in"
      description="Welcome back to NextChapter for Employers."
    >
      <Suspense>
        <LoginForm
          defaultNext="/talent"
          forgotPasswordHref="/talent/forgot-password"
          signupHref="/talent/signup"
          showGoogle={false}
        />
      </Suspense>
    </PortalAuthCard>
  )
}
