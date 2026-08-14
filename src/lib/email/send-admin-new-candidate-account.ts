import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import AdminNewCandidateAccountEmail from '@/emails/admin-new-candidate-account'

async function sendAdminNewCandidateAccountEmail(
  adminEmail: string,
  candidateId: string,
  candidateName: string,
  candidateEmail: string,
  recentCompany: string | null,
  situation: string | null,
  location: string | null,
  signupIp: string | null
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping admin new-candidate email.')
    return { sent: false as const }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const adminUrl = `${appUrl}/support/admin/candidates/${candidateId}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: adminEmail,
      subject: `New candidate: ${candidateName}`,
      react: AdminNewCandidateAccountEmail({
        candidateName,
        candidateEmail,
        recentCompany,
        situation,
        location,
        signupIp,
        adminUrl,
      }),
    })

    if (error) {
      console.error('Failed to send admin new-candidate email:', error)
      return { sent: false as const }
    }
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send admin new-candidate email:', error)
    return { sent: false as const }
  }
}

// The single admin "new candidate" notification — call this from any place
// that might have just learned a candidate's name/email (resume extraction,
// the create-account email fallback). No-ops until firstName, lastName, and
// email are all known, and never sends twice for the same candidate
// (adminNewCandidateEmailSentAt gates it, claimed via an updateMany guard so
// two near-simultaneous callers can't both send). Replaces the old
// "New candidate account: Unnamed" / "Resume uploaded: Unnamed" pair that
// fired before any of this was known.
export async function maybeNotifyAdminOfNewCandidate(candidateId: string): Promise<void> {
  const adminEmail = getAccountActivityAdminEmail()
  if (!adminEmail) return

  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      currentCity: true,
      currentState: true,
      currentJobStatus: true,
      signupIp: true,
      adminNewCandidateEmailSentAt: true,
    },
  })
  if (!profile || profile.adminNewCandidateEmailSentAt) return
  if (!profile.firstName || !profile.lastName || !profile.email) return

  const mostRecentJob = await prisma.workHistoryEntry.findFirst({
    where: { candidateId },
    orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    select: { companyName: true },
  })

  const candidateName = `${profile.firstName} ${profile.lastName}`
  const location = [profile.currentCity, profile.currentState].filter(Boolean).join(', ') || null
  const situation = profile.currentJobStatus ? CURRENT_JOB_STATUS_LABELS[profile.currentJobStatus] : null

  // Claim before sending — an updateMany that only matches while still
  // unsent, so a second caller racing in (e.g. resume extraction and the
  // create-account email fallback firing close together) sees count: 0 and
  // skips the send rather than double-emailing.
  const claimed = await prisma.candidateProfile.updateMany({
    where: { id: candidateId, adminNewCandidateEmailSentAt: null },
    data: { adminNewCandidateEmailSentAt: new Date() },
  })
  if (claimed.count === 0) return

  await sendAdminNewCandidateAccountEmail(
    adminEmail,
    candidateId,
    candidateName,
    profile.email,
    mostRecentJob?.companyName ?? null,
    situation,
    location,
    profile.signupIp
  )
}
