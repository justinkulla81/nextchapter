import 'server-only'

// Admin-only Google OAuth client (Connect Google for the CRM/inbox sweep, and
// the Webinars/Meeting Prep calendar connection). Kept separate from the
// candidate client so the candidate app's Google verification only has to
// cover gmail.readonly + calendar.events.readonly — gmail.send,
// calendar.events (write) and documents.readonly stay on this admin client,
// which runs "In production" unverified (fine for <100 users, one-time
// "unverified app" warning, and no 7-day Testing-mode token expiry).
//
// Falls back to the candidate client until ADMIN_GOOGLE_OAUTH_CLIENT_ID/SECRET
// are set, so deploying this changes nothing on its own. Once they're set,
// admin connections authorized under the old client stop refreshing and need
// one reconnect. ID and secret are always taken as a pair — never one of each.
export function adminGoogleClient(): { clientId: string | undefined; clientSecret: string | undefined } {
  if (process.env.ADMIN_GOOGLE_OAUTH_CLIENT_ID) {
    return {
      clientId: process.env.ADMIN_GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.ADMIN_GOOGLE_OAUTH_CLIENT_SECRET,
    }
  }
  return {
    clientId: process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_SECRET,
  }
}
