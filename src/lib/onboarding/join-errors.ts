import { googleConnectErrorMessage } from '@/lib/google/connect-error-copy'

// What the sign-up page shows when the Google round trip sends the visitor back
// with ?error=<code>. Each message says what happened and what to do next.
export function joinErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  switch (code) {
    case 'denied':
      return "You closed Google before finishing, so nothing was saved. Try again when you're ready."
    case 'invalid_state':
      return 'That sign-in expired. Please try again.'
    case 'unconfirmed_account':
      return 'That email already has an account we never finished confirming. Open the confirmation email we sent you, click its link, and then come back.'
    case 'session_failed':
    case 'exchange_failed':
      return 'Something went wrong signing you in. Please try again.'
    case 'not_configured':
      return 'Sign-in with Google is not available right now. Please try again in a little while.'
    default:
      return googleConnectErrorMessage(code, 'gmail')
  }
}
