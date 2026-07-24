import { emailStyles } from '@/lib/email/email-styles'

interface RecruiterCandidateInviteEmailProps {
  recruiterName: string
  firmName: string | null
  acceptUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '16px',
  padding: '12px 20px',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

// Sent from a recruiter's own private candidate book — the CTA is a
// Supabase-minted magic link (action_link from admin.generateLink), not a
// link to a NextChapter accept page. Don't swap this for a same-domain link;
// that would break the pre-confirmed session the link is supposed to carry.
export default function RecruiterCandidateInviteEmail({
  recruiterName,
  firmName,
  acceptUrl,
}: RecruiterCandidateInviteEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        {recruiterName}
        {firmName ? ` (${firmName})` : ''} wants to work with you and suggested you set up a free NextChapter
        account — a platform that turns your job search into a structured, coached plan and gives recruiters a
        direct line to reach you.
      </p>
      <a href={acceptUrl} style={button}>
        Set up your account →
      </a>
      <p style={footer}>If you weren&apos;t expecting this, you can ignore this email.</p>
    </div>
  )
}
