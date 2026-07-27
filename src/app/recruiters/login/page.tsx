import { Suspense } from 'react'
import { Users } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'

export default function RecruiterLoginPage() {
  return (
    <PortalAuthCard
      icon={Users}
      portalLabel="Recruiters"
      title="Log in"
      description="Welcome back to NextChapter for Recruiters."
    >
      <Suspense>
        <LoginForm
          defaultNext="/recruiters/dashboard"
          forgotPasswordHref="/recruiters/forgot-password"
          signupHref="/recruiters/signup"
          showGoogle={false}
        />
      </Suspense>
    </PortalAuthCard>
  )
}
