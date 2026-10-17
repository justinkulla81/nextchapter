import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { isOnboardingV2ConnectEnabled, isOnboardingV2Enabled } from '@/lib/onboarding/v2-flag'
import { joinErrorMessage } from '@/lib/onboarding/join-errors'
import { JoinWithGoogle } from '@/components/onboarding/JoinWithGoogle'
import { JoinErrorNotice } from '@/components/onboarding/JoinErrorNotice'

export const metadata: Metadata = { title: 'Start your search', robots: { index: false, follow: false } }

// Onboarding v2 sign-up (docs/onboarding-v2.md): one screen, one button. The
// same button signs a returning member back in.
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isOnboardingV2Enabled()) redirect('/onboarding/desire')

  // Already signed up: the hub decides where they are in the flow.
  const user = await getCurrentUser()
  if (user && !user.is_anonymous) redirect('/onboarding')

  const { error } = await searchParams
  const errorMessage = joinErrorMessage(error)
  const connect = isOnboardingV2ConnectEnabled()

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Start your search with Google</h1>
        <p className="text-muted-foreground">
          NextChapter is free. Searching is still work, and you get out what you put in.
          {connect && ' Connecting your inbox and calendar lets us track that work for you, and show employers it is real.'}
        </p>
      </div>

      {error && errorMessage && <JoinErrorNotice code={error} message={errorMessage} />}

      <section aria-labelledby="what-we-read" className="space-y-3">
        <h2 id="what-we-read" className="text-base font-semibold">
          {connect ? 'What we read, and what we don’t do' : 'What happens next'}
        </h2>
        {connect ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>We read your Gmail and Calendar, read-only, looking for job-search email and events from the last 3 months.</li>
            <li>We keep what we find (the company, role, date and subject line), not the text of your messages.</li>
            <li>We never send, delete or share anything. You can disconnect at any time.</li>
            <li>Personal Gmail accounts only for now, so your search stays private from your employer.</li>
          </ul>
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>You sign in with your Google account. We get your name and email address, nothing else.</li>
            <li>After that you can add Gmail and Calendar tracking, so your applications and conversations count themselves.</li>
            <li>Personal Gmail accounts only for now, so your search stays private from your employer.</li>
          </ul>
        )}
      </section>

      <div className="space-y-4">
        <JoinWithGoogle asks={connect ? 'sign_in_and_inbox' : 'sign_in_only'} />
        <p className="text-sm text-muted-foreground">
          No personal Gmail?{' '}
          <Link href="/onboarding/desire?classic=1" className="font-medium text-brand underline-offset-4 hover:underline">
            Continue with email instead
          </Link>
        </p>
      </div>
    </div>
  )
}
