import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveClaimableOrg } from '@/lib/org-claims/org'
import { ConfirmClaimButton } from '@/components/prospects/ConfirmClaimButton'

export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Confirm your claim | NextChapter' } }
export const dynamic = 'force-dynamic'

// The link in the email lands here. Opening it changes nothing; the button does, so an email scanner that follows links cannot spend the token.
export default async function VerifyClaimPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const org = await resolveClaimableOrg(slug)
  if (!org) notFound()
  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-16 sm:px-6">
      <p className="font-semibold text-navy">NextChapter</p>
      <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-navy">Confirm your claim on the {org.name} page</h1>
      <p className="text-muted-foreground">Confirming shows that you can read mail at the address you gave. It is the last step.</p>
      <ConfirmClaimButton token={token} slug={slug} orgName={org.name} />
    </main>
  )
}
