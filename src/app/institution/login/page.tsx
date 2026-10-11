import { Suspense } from 'react'
import { GraduationCap } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirectIfAuthenticated } from '@/lib/auth/redirect-if-authenticated'
import { NOINDEX } from '@/lib/seo/canonical'

export const metadata = NOINDEX

export default async function InstitutionLoginPage() {
  await redirectIfAuthenticated('/institution', 'institution')

  return (
    <PortalAuthCard
      icon={GraduationCap}
      portalLabel="Colleges"
      title="Log in"
      description="Welcome back to NextChapter for colleges."
    >
      <Suspense>
        <LoginForm
          defaultNext="/institution"
          forgotPasswordHref="/institution/forgot-password"
          signupHref={null}
          showGoogle={false}
          portal="institution"
        />
      </Suspense>
    </PortalAuthCard>
  )
}
