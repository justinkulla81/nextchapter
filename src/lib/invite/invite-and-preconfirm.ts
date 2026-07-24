import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export interface PreConfirmedInviteResult {
  actionLink?: string
  error?: string
}

// Shared by every "invite a specific pre-confirmed email into the product"
// flow (coach client invites, recruiter-sourced candidate invites): creates
// a fresh, pre-confirmed Supabase auth user for `email` (skipping it if one
// was already created by a prior send — a resend just mints a new link for
// the existing user) and returns the magic link that lands them on
// `redirectTo` already authenticated.
export async function createPreConfirmedInviteUser(
  email: string,
  redirectTo: string,
  { isFirstSend }: { isFirstSend: boolean }
): Promise<PreConfirmedInviteResult> {
  const admin = createAdminClient()

  if (isFirstSend) {
    const { error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true })
    if (createError) {
      // Most likely someone else raced us to register this email between
      // the caller's duplicate-check and here.
      return { error: 'This email address can’t be invited right now. Please try again.' }
    }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })
  if (linkError || !linkData.properties?.action_link) {
    console.error('Failed to generate pre-confirmed invite link:', linkError)
    return { error: 'Something went wrong sending the invite. Please try again.' }
  }

  return { actionLink: linkData.properties.action_link }
}
