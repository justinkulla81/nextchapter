import { Suspense } from 'react'
import { HeartHandshake } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirectIfAuthenticated } from '@/lib/auth/redirect-if-authenticated'

export default async function CoachLoginPage() {
  await redirectIfAuthenticated('/support/coach')

  return (
    <PortalAuthCard
      icon={HeartHandshake}
      portalLabel="Coaches"
      title="Log in"
      description="Welcome back to NextChapter for Coaches."
    >
      <Suspense>
        <LoginForm
          defaultNext="/support/coach"
          forgotPasswordHref="/support/coach/forgot-password"
          signupHref="/support/coach/signup"
          showGoogle={false}
        />
      </Suspense>
    </PortalAuthCard>
  )
}
