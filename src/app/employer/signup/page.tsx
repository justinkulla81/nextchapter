import { Building2 } from 'lucide-react'
import Link from 'next/link'
import { PortalAuthCard } from '@/components/auth/PortalAuthCard'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// NextChapter for Employers is a contract-sold outplacement benefit, not a
// self-serve sign-up product — an organization has to sign an outplacement
// contract (§A9, admin-managed) before a portal login exists for them, and
// NextChapter invites that organization's first employer_admin once the
// contract is set up (see src/lib/admin/outplacement-contracts.ts,
// inviteFirstOrgAdmin). This page is the honest landing spot for anyone who
// reaches /employer without an accepted invite — a real explainer, not a
// disabled form pretending self-serve signup exists.
export default function EmployerSignupPage() {
  return (
    <PortalAuthCard
      icon={Building2}
      portalLabel="Employers"
      title="Employer accounts are set up with your contract"
      description="NextChapter for Employers accounts aren't self-serve — they're provisioned when your organization sets up an outplacement contract."
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          If your organization already has a NextChapter outplacement contract, check your email for an
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
