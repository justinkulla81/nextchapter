import { emailStyles } from '@/lib/email/email-styles'

interface MembershipNoticeEmailProps {
  heading: string
  bodyLines: string[]
  ctaLabel: string
  ctaUrl: string
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

const heading: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  marginTop: '8px',
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

// Shared, parametrized template for Membership benefit-delivery emails
// (annual Dossier refresh ready, quarterly market check ready, network-
// maintenance nudge, break-glass reactivation confirmation) — one component
// instead of four near-identical ones, following the same "keep it minimal"
// judgment this session has applied elsewhere.
export default function MembershipNoticeEmail({ heading: headingText, bodyLines, ctaLabel, ctaUrl }: MembershipNoticeEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={heading}>{headingText}</p>
      {bodyLines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      <a href={ctaUrl} style={button}>
        {ctaLabel} →
      </a>
      <p style={footer}>You&apos;re receiving this because you&apos;re a NextChapter Member.</p>
    </div>
  )
}
