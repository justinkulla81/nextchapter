import { emailStyles } from '@/lib/email/email-styles'

interface CoachClientInviteEmailProps {
  coachName: string
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

// Sent from a coach-initiated invite, not a self-serve signup — the CTA is
// a Supabase-minted magic link (action_link from admin.generateLink), not a
// link to a NextChapter accept page. Don't swap this for a same-domain link;
// that would break the pre-confirmed session the link is supposed to carry.
export default function CoachClientInviteEmail({ coachName, firmName, acceptUrl }: CoachClientInviteEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        {coachName}
        {firmName ? ` (${firmName})` : ''} invited you to work together on NextChapter — a free platform that
        turns your job search into a structured, coached plan.
      </p>
      <a href={acceptUrl} style={button}>
        Set up your account →
      </a>
      <p style={footer}>If you weren&apos;t expecting this, you can ignore this email.</p>
    </div>
  )
}
