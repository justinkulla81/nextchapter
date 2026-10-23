import 'server-only'
import { CALENDAR_READ_SCOPE, GMAIL_READ_SCOPE } from '@/lib/google/grant'
import { callbackOriginForAppPath } from '@/lib/portal-hosts'

// The Google round trip that creates the account and connects Gmail and Calendar. It uses the same candidate OAuth client as the
// Connect Gmail buttons, with its own redirect URI, which must be added to that
// client in Google Cloud Console: <candidate origin>/api/auth/join/callback
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

const IDENTITY_SCOPES = ['openid', 'email', 'profile']

export function getJoinRedirectUri(): string {
  // The candidate app's host (candidate.<site> once it's switched on): the nonce cookie and the session are host-only,
  // so the round trip has to come back to the host that started it.
  return `${callbackOriginForAppPath('/onboarding')}/api/auth/join/callback`
}

// One consent covers sign-in and both permissions: connecting is the account step, not an extra.
export function joinScopes(): string[] {
  return [...IDENTITY_SCOPES, GMAIL_READ_SCOPE, CALENDAR_READ_SCOPE]
}

export function buildJoinAuthUrl(state: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getJoinRedirectUri(),
    response_type: 'code',
    scope: joinScopes().join(' '),
    state,
    // Always show consent, which is what makes Google issue a refresh token every time, and let them pick the account.
    prompt: 'consent select_account',
    access_type: 'offline',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}
