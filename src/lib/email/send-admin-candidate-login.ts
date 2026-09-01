import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import AdminCandidateLoginEmail from '@/emails/admin-candidate-login'

// Called from recordCandidateLoginIfDue right after it actually creates a
// new CandidateLoginEvent row — that function's own 30-minute dedupe window
// is what keeps this to once per real login, not once per dashboard page
// load. Best-effort: a failed send here never blocks recording the login
// itself (see the caller's try/catch).
export async function notifyAdminOfCandidateLogin(candidateId: string, ip: string | null): Promise<void> {
  const adminEmail = getAccountActivityAdminEmail()
  if (!adminEmail || !process.env.RESEND_API_KEY) return

  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { firstName: true, lastName: true, email: true },
  })
  if (!profile) return

  const candidateName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'A candidate'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: adminEmail,
      subject: `${candidateName} logged in`,
      react: AdminCandidateLoginEmail({
        candidateName,
        candidateEmail: profile.email ?? 'unknown',
        ip,
        loggedInAt: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }),
        adminUrl: `${appUrl}/support/admin/candidates/${candidateId}`,
      }),
    })
    if (error) console.error('Failed to send admin candidate-login email:', error)
  } catch (error) {
    console.error('Failed to send admin candidate-login email:', error)
  }
}
