// Whether NextChapter asks members to connect Google (Gmail and Calendar) at all: in onboarding, on the dashboard, and as something that
// locks other features.
//
// OFF by default. Reading a member's Gmail and Calendar needs Google's restricted-scope verification (the CASA security assessment), which
// is pending. Until it passes, the app is in Google's testing mode and only listed testers can
// connect, so a required "Continue with Google" step, and features that stay locked until you connect, shut everyone else out.
//
// While it is off:
//   - the account is created with an email and a password (confirmation link), the same way the classic onboarding does it;
//   - the Google reveal after sign-up is skipped;
//   - no Connect Gmail / Calendar prompt is shown, and nothing is locked behind having connected (Victoria's weekly advice, the
//     "connect accounts" note, the Network unlock, the activation item);
//   - members who already connected keep working: syncing and the Reconnect banner are untouched.
//
// To turn it back on after CASA: set GOOGLE_CONNECT_ENABLED=on in Vercel production and redeploy. The to-do hub carries this reminder.

export function isGoogleConnectOn(env: Record<string, string | undefined> = process.env): boolean {
  return (env.GOOGLE_CONNECT_ENABLED ?? '').trim().toLowerCase() === 'on'
}
