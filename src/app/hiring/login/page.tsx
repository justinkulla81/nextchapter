import { Suspense } from 'react'
import { Briefcase } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirectIfAuthenticated } from '@/lib/auth/redirect-if-authenticated'

export default async function HiringManagerLoginPage() {
  await redirectIfAuthenticated('/hiring/dashboard', 'hiring')

  return (
    <PortalAuthCard
      icon={Briefcase}
      portalLabel="Hiring"
      title="Log in"
      description="Welcome back to NextChapter for Hiring."
    >
      <Suspense>
        <LoginForm
          defaultNext="/hiring/dashboard"
          forgotPasswordHref="/hiring/forgot-password"
          signupHref="/hiring/signup"
          showGoogle={false}
          portal="hiring"
        />
      </Suspense>
    </PortalAuthCard>
  )
}
