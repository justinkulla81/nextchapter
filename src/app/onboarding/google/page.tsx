import { redirect } from 'next/navigation'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { GoogleReveal } from '@/components/onboarding/bundles/GoogleReveal'
import { withOAuthReturnTo } from '@/lib/google/oauth-links'
import { googleConnectErrorMessage } from '@/lib/google/connect-error-copy'
import { connectReason } from '@/lib/journey/engagement'
import { effectiveJourney } from '@/lib/journey/journey'
import { flowOfProfile } from '@/lib/onboarding/flag'
import { progressOf } from '@/lib/onboarding/progress'
import { loadScanStatus } from '@/lib/onboarding/scan-counts'
import { isGoogleConnectOn } from '@/lib/google/connect-switch'

const GOOGLE_REVEAL_PATH = '/onboarding/google'

// The Google reveal: the last step of the short question bundles. It needs a real account (Google's consent
// screen starts from a signed-in email), so it comes right after the account is created. Optional.
export default async function GoogleRevealPage({ searchParams }: { searchParams: Promise<{ gmailError?: string; calendarError?: string }> }) {
  const profile = await getCandidateProfileForUser()
  if (!profile.registrationCompletedAt) redirect('/onboarding')
  // Off until CASA (src/lib/google/connect-switch.ts): nothing to connect, so on to the welcome.
  if (!isGoogleConnectOn()) redirect('/onboarding/welcome')
  if (flowOfProfile(profile) !== 'bundles' || progressOf(profile.journeyDetails).googleRevealAt) redirect('/onboarding/welcome')

  const params = await searchParams
  const errorMessage =
    (params.gmailError && googleConnectErrorMessage(params.gmailError, 'gmail')) || (params.calendarError && googleConnectErrorMessage(params.calendarError, 'calendar')) || null
  const status = await loadScanStatus(profile.id)

  return (
    <GoogleReveal
      initial={status}
      connectHref={withOAuthReturnTo('/api/auth/google-connect/start', GOOGLE_REVEAL_PATH)}
      errorMessage={errorMessage}
      reason={connectReason(effectiveJourney(profile), 'gmail')}
    />
  )
}
