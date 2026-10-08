import { RecruiterSignupForm } from '@/components/recruiter/RecruiterSignupForm'
import { findClaimableFirm } from '@/lib/recruiter/firm-invite'
import { NOINDEX } from '@/lib/seo/canonical'

export const metadata = NOINDEX

export default async function RecruiterSignupPage({ searchParams }: { searchParams: Promise<{ firm?: string }> }) {
  const { firm: firmToken } = await searchParams
  const invited = await findClaimableFirm(firmToken)
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        {invited ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Create your login for {invited.name}</h1>
            <p className="text-muted-foreground">Next you set up your page, your look and your connections.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Get your calibration tool</h1>
            <p className="text-muted-foreground">
              Paste a client brief and get an instant memo on redundant requirements, conflicts, and
              candidates you might be overlooking.
            </p>
          </>
        )}
      </div>
      <RecruiterSignupForm firmToken={invited ? firmToken : undefined} invitedFirmName={invited?.name} />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already set up?{' '}
        <a href="/recruiters/login" className="underline underline-offset-4">
          Log in
        </a>
      </p>
    </div>
  )
}
