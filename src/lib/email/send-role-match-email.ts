import 'server-only'
import { Resend } from 'resend'
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
}

// No opt-out check, no unsubscribe link — same precedent as
// send-employer-interest.ts for this class of "something/someone matched
// you" transactional email.
export async function sendRoleMatchEmail(
  candidate: { userId: string; firstName: string | null },
  role: RoleMatchEmailRole,
  dossierUnlocked: boolean
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
  const unlockUrl = `${appUrl}/dossier`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: email,
      subject: dossierUnlocked ? 'A new opportunity matches your background' : 'A strong-fit opportunity is waiting for you',
      react: RoleMatchEmail({
        firstName: candidate.firstName,
        dossierUnlocked,
        role,
        actionUrl: dossierUnlocked ? `${appUrl}${destinationPath}` : unlockUrl,
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
