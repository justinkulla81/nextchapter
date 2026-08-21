import { emailStyles } from '@/lib/email/email-styles'

interface CrucibleContestInviteEmailProps {
  companyName: string
  contestTitle: string
  entryUrl: string
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
  fontSize: '18px',
  fontWeight: 700,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '16px',
  padding: '12px 20px',
  backgroundColor: '#2F4B8F',
  color: '#ffffff',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

// Own the visible sender name below (see send-crucible-contest-invite.ts's
// comment on why the underlying domain is still launchyournextchapter.com)
// — this is the one place a candidate actually sees the brand, so the
// wordmark treatment matters even in a plain-CSS email context.
export default function CrucibleContestInviteEmail({
  companyName,
  contestTitle,
  entryUrl,
}: CrucibleContestInviteEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>
        <span style={{ color: '#7A9900' }}>no</span>
        <span style={{ color: '#6b7280', fontWeight: 400 }}>experience</span>
        <span style={{ color: '#C2168A' }}>needed</span>
        <span style={{ color: '#1478C8' }}>.ai</span>
      </p>
      <p>You passed — and an employer wants your take on something real.</p>
      <p>
        <strong>{companyName}</strong> posted a contest: <strong>{contestTitle}</strong>. Submit your idea for a
        shot at a tailored, paid hire. No account needed.
      </p>
      <a href={entryUrl} style={button}>
        View the contest →
      </a>
      <p style={footer}>
        This is a one-time invite link tied to your assessment result — no password, no account required.
      </p>
    </div>
  )
}
