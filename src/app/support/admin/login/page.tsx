import { Suspense } from 'react'
import { ShieldCheck } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'

export default function AdminLoginPage() {
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
