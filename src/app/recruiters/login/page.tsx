import { Suspense } from 'react'
import { Users } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirectIfAuthenticated } from '@/lib/auth/redirect-if-authenticated'

export default async function RecruiterLoginPage() {
  await redirectIfAuthenticated('/recruiters/dashboard', 'recruiter')

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
          portal="recruiter"
        />
      </Suspense>
    </PortalAuthCard>
  )
}
