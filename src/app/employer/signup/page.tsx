import { Building2 } from 'lucide-react'
import Link from 'next/link'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NOINDEX } from '@/lib/seo/canonical'
import { createClient } from '@/lib/supabase/server'
import { signOutEmployer } from '@/app/auth/portal-sign-out'
import { SignOutForm } from '@/components/auth/SignOutForm'

export const metadata = NOINDEX

// NextChapter for Employers is a contract-sold outplacement benefit, not a
// self-serve sign-up product — an organization has to sign an outplacement
// contract (§A9, admin-managed) before a portal login exists for them, and
// NextChapter invites that organization's first employer_admin once the
// contract is set up (see src/lib/admin/outplacement-contracts.ts,
// inviteFirstOrgAdmin). This page is the honest landing spot for anyone who
// reaches /employer without an accepted invite — a real explainer, not a
// disabled form pretending self-serve signup exists.
export default async function EmployerSignupPage() {
  // Someone signed in with an account that isn't on any employer: say which one, and let them switch.
  const supabase = await createClient('employer')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <PortalAuthCard
      icon={Building2}
      portalLabel="Employers"
      title="Employer accounts are set up with your contract"
      description="NextChapter for Employers accounts aren't self-serve — they're provisioned when your company sets up a NextChapter contract (hiring, employees or outplacement)."
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        {user?.email && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-foreground">
            <p>
              You’re signed in as <span className="font-medium">{user.email}</span>, which isn’t on an employer account yet.
            </p>
            <SignOutForm action={signOutEmployer} className="mt-2">
              <button type="submit" className="text-sm font-medium text-brand underline underline-offset-4">
                Sign out and use another account
              </button>
            </SignOutForm>
          </div>
        )}
        <p>
          If your company already has a NextChapter contract, check your email for an
          invite from NextChapter, or ask whoever set up the account to invite you from their Team page.
        </p>
        <p>Starting a new contract? Reach out and we&apos;ll get your account set up.</p>
      </div>
      <div className="mt-6 flex flex-col gap-2">
        <a href="mailto:support@launchyournextchapter.com" className={cn(buttonVariants({ variant: 'default' }), 'w-full')}>
          Contact NextChapter
        </a>
        <Link href="/employer/login" className="text-center text-sm text-muted-foreground underline underline-offset-4">
          Already have an account? Log in
        </Link>
      </div>
    </PortalAuthCard>
  )
}
