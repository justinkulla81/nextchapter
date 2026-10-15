import { emailStyles } from '@/lib/email/email-styles'

interface Props {
  orgName: string
  endsOn: string
  dashboardUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#0b2545' }
const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

// Sent 14 days before an outplacement seat's access ends, only when the
// employer switched access-ending notices on.
export default function OutplacementAccessEndingEmail({ orgName, endsOn, dashboardUrl }: Props) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        The NextChapter benefit from {orgName} ends on {endsOn}. Until then everything stays open: coaching, the recruiter network and your search plan.
      </p>
      <p>Before that date, download your resume and anything else you want to keep. Your free NextChapter account stays yours afterwards.</p>
      <p>
        <a href={dashboardUrl}>Open NextChapter</a>
      </p>
      <p style={footer}>{orgName} never sees your activity on NextChapter. Questions? Reply to this email.</p>
    </div>
  )
}
