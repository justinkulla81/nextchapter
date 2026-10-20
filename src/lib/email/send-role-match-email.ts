import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import RoleMatchEmail from '@/emails/role-match'
import type { RoleProfileType } from '@prisma/client'

export interface RoleMatchEmailRole {
  id: string
  roleTitle: string
  type: RoleProfileType
  companyName: string
  description: string | null
  compLabel: string
  /** The job card's verdict (job-card.ts): "Strong fit" / "Good fit" / "Worth a look". */
  verdict: string
}

// No opt-out check, no unsubscribe link — same precedent as
// send-employer-interest.ts for this class of "something/someone matched
// you" transactional email.
export async function sendRoleMatchEmail(
  candidate: { userId: string; firstName: string | null },
  role: RoleMatchEmailRole
): Promise<{ sent: boolean }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping role match email.')
    return { sent: false }
  }

  const admin = createAdminClient()
  const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
  const email = userData.user?.email
  if (!email) return { sent: false }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const destinationPath =
    role.type === 'FULL_TIME'
      ? '/dashboard/find-my-job#employer-matched-roles'
      : '/dashboard/interim-work#board-advisory-work'

  try {
    const resend = createResend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: email,
      subject: 'A new opportunity matches your background',
      react: RoleMatchEmail({
        firstName: candidate.firstName,
        role,
        actionUrl: `${appUrl}${destinationPath}`,
      }),
    })

    if (error) {
      console.error('Failed to send role match email:', error)
      return { sent: false }
    }
    return { sent: true }
  } catch (error) {
    console.error('Failed to send role match email:', error)
    return { sent: false }
  }
}
