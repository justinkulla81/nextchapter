import { emailStyles } from '@/lib/email/email-styles'

interface BenefitsNetworkVerifyEmailProps {
  alumName: string
  institutionName: string
  programName: string
  confirmUrl: string
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

export default function BenefitsNetworkVerifyEmail({
  alumName,
  institutionName,
  programName,
  confirmUrl,
}: BenefitsNetworkVerifyEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        {alumName} has proposed listing <strong>{programName}</strong> from{' '}
        <strong>{institutionName}</strong> on NextChapter&apos;s Alumni Benefits Network — a catalog of discounts
        and programs offered to NextChapter members through alumni relationships.
      </p>
      <p>
        Because you&apos;re receiving this at an address on {institutionName}&apos;s own domain, clicking the link
        below confirms that this offer is real and that {alumName} is authorized to extend it on the
        institution&apos;s behalf. The listing will not appear in our catalog until this is confirmed.
      </p>
      <a href={confirmUrl} style={button}>
        Confirm this offer →
      </a>
      <p style={footer}>
        If you weren&apos;t expecting this or don&apos;t recognize {alumName}, you can safely ignore this email — the
        listing will simply never go live.
      </p>
    </div>
  )
}
