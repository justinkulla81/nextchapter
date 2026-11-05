// Two prompts on a public job page ask whether the visitor already has an account: the sign-in prompt that opens on arrival
// (MemberSignInPrompt) and the one on "Check my fit" (CheckFitButton). Once the visitor has answered either one ("Stay on this page",
// "No, I'm new"), the other stays away for the browser session. No server-only imports.
export const SIGNIN_ASKED_KEY = 'nc_job_signin_asked_v1'

export function markSigninAsked(): void {
  try {
    sessionStorage.setItem(SIGNIN_ASKED_KEY, '1')
  } catch {}
}

export function signinAsked(): boolean {
  try {
    return !!sessionStorage.getItem(SIGNIN_ASKED_KEY)
  } catch {
    return false
  }
}
