import { Suspense } from 'react'
import { ShieldCheck } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { redirectIfAuthenticated } from '@/lib/auth/redirect-if-authenticated'

export default async function AdminLoginPage() {
  await redirectIfAuthenticated('/support/admin')

  return (
    <PortalAuthCard
      icon={ShieldCheck}
      portalLabel="Admin"
      title="Admin log in"
      description="Internal access only."
    >
      <Suspense>
        <LoginForm
          defaultNext="/support/admin"
          forgotPasswordHref="/support/admin/forgot-password"
          signupHref={null}
          showGoogle={false}
        />
      </Suspense>
    </PortalAuthCard>
  )
}
