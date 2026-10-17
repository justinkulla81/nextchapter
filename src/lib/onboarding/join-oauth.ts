import 'server-only'
import { CALENDAR_READ_SCOPE, GMAIL_READ_SCOPE } from '@/lib/google/grant'

// The sign-up Google round trip. It uses the same candidate OAuth client as the
// Connect Gmail buttons, with its own redirect URI, which must be added to that
// client in Google Cloud Console: <NEXT_PUBLIC_APP_URL>/api/auth/join/callback
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

const IDENTITY_SCOPES = ['openid', 'email', 'profile']

export function getJoinRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/auth/join/callback`
}

export function joinScopes(connect: boolean): string[] {
  return connect ? [...IDENTITY_SCOPES, GMAIL_READ_SCOPE, CALENDAR_READ_SCOPE] : IDENTITY_SCOPES
}

export function buildJoinAuthUrl(state: string, connect: boolean, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getJoinRedirectUri(),
    response_type: 'code',
    scope: joinScopes(connect).join(' '),
    state,
    // Sign-in only: let them pick the account. Connecting: always show consent,
    // which is what makes Google issue a refresh token every time.
    prompt: connect ? 'consent select_account' : 'select_account',
    ...(connect ? { access_type: 'offline' } : {}),
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}
