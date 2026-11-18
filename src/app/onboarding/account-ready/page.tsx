import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSessionIdentity } from '@/lib/supabase/get-current-user'
import { readAccountToken } from '@/lib/leads/light-account'
import { findExistingRegisteredAccount } from '@/lib/onboarding/duplicate-check'
import { cleanCompanyText } from '@/lib/jobs/public-job-page'
import { AccountReadyForm, type ReadyJob } from '@/components/onboarding/light/AccountReadyForm'
import { openLightAccount } from './actions'

export const dynamic = 'force-dynamic'

const SITE = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'

// The "Open my account" button in a follow-up email lands here (owner decision 2026-11-18). One headline, the job they saved,
// their name, one button. A full member is sent to sign in; someone already in their light account goes straight to it.
export default async function AccountReadyPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  const email = readAccountToken(t)
  if (!email || !t) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-ink">This link has expired.</h1>
        <p className="text-base text-muted-foreground">Open the newest email from us, or save a job again and we send you a fresh link.</p>
        <a href={`${SITE()}/jobs`} className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
          Browse jobs
        </a>
      </div>
    )
  }

  const who = await getSessionIdentity()
  if (who && !who.isAnonymous && who.email?.toLowerCase() === email) {
    const own = await prisma.candidateProfile.findUnique({ where: { userId: who.id }, select: { registrationCompletedAt: true } })
    redirect(own?.registrationCompletedAt ? '/dashboard' : '/onboarding/your-jobs')
  }

  if (await findExistingRegisteredAccount(email, '')) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-ink">You already have an account.</h1>
        <p className="text-base text-muted-foreground">Sign in with this email and your saved jobs are there.</p>
        <Link href="/auth/login?next=%2Fdashboard" className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
          Sign in
        </Link>
      </div>
    )
  }

  // The jobs they saved or went to apply for, newest first: a narrow read of at most three postings.
  const leads = await prisma.homepageLead.findMany({ where: { email, kind: 'apply_save' }, orderBy: { createdAt: 'desc' }, select: { searchQ: true }, take: 3 })
  const ids = leads.map((l) => l.searchQ).filter((id): id is string => !!id)
  const rows = ids.length ? await prisma.exclusiveJobPosting.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, companyName: true } }) : []
  const jobs: ReadyJob[] = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r).map((r) => ({ title: r.title, company: cleanCompanyText(r.companyName) }))

  return <AccountReadyForm token={t} jobs={jobs} action={openLightAccount} />
}
