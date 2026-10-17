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
      return 'An account with that email already exists but was never confirmed. Continue with email instead, and use the link we sent you.'
    case 'session_failed':
    case 'exchange_failed':
      return 'Something went wrong signing you in. Please try again.'
    case 'not_configured':
      return 'Sign-in with Google is not available right now. You can continue with email instead.'
    default:
      return googleConnectErrorMessage(code, 'gmail')
  }
}
