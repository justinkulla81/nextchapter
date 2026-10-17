import 'server-only'

// Onboarding v2 (docs/onboarding-v2.md) is off unless these are set, so deploying
// the code changes nothing for members.
//
// ONBOARDING_V2=1          the Google sign-up page, the scan reveal, and routing
//                          new visitors there instead of the classic steps.
// ONBOARDING_V2_CONNECT=1  also ask for Gmail and Calendar on that sign-up. Leave
//                          this off until Google has approved the app for general
//                          use; while it is off, sign-up asks for sign-in only.
export function isOnboardingV2Enabled(): boolean {
  return process.env.ONBOARDING_V2 === '1'
}

export function isOnboardingV2ConnectEnabled(): boolean {
  return isOnboardingV2Enabled() && process.env.ONBOARDING_V2_CONNECT === '1'
}
