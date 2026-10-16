import { Suspense } from 'react'
import Link from 'next/link'
import { Landmark } from 'lucide-react'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { safeNext } from '@/lib/auth/safe-next'
import { NOINDEX } from '@/lib/seo/canonical'

export const metadata = NOINDEX

// Sign-in for college and workforce org portals (/highered, /workforce):
// staff, member companies and NextChapter admins. Its own session cookie,
// separate from the candidate login, which members use instead.
export default async function OrgLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const dest = safeNext(next, '/')
  return (
    <PortalAuthCard icon={Landmark} portalLabel="Colleges and workforce partners" title="Log in" description="For staff, member companies and partners.">
      <Suspense>
        <LoginForm defaultNext="/" forgotPasswordHref="/auth/forgot-password" signupHref={null} showGoogle={false} portal="org" />
      </Suspense>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Job seeker or alum?{' '}
        <Link href={`/auth/login?next=${encodeURIComponent(dest)}`} className="font-medium text-primary hover:underline">
          Log in here
        </Link>
      </p>
    </PortalAuthCard>
  )
}
