import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface Props {
  orgName: string
  endsOn: string
  dashboardUrl: string
  // A career growth seat (people staying and growing) rather than outplacement.
  growth?: boolean
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
export default function OutplacementAccessEndingEmail({ orgName, endsOn, dashboardUrl, growth }: Props) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        The NextChapter benefit from {orgName} ends on {endsOn}. Until then everything stays open{growth ? ': coaching, the recruiter network and your career plan' : ': coaching, the recruiter network and your search plan'}.
      </p>
      <p>
        {growth
          ? 'Your career story, goals, learning paths and pay research are yours and stay on your free account. Only the coaching and recruiter network your employer provided stop. Nothing about your plan changes on that day.'
          : 'Your search plan, tracked jobs and contacts stay on your free account. Only the coaching and recruiter network your employer provided stop. Download your resume and anything else you want to keep.'}
      </p>
      <p>
        <a href={dashboardUrl}>Open NextChapter</a>
      </p>
      <p style={footer}>{orgName} never sees your activity on NextChapter. Questions? Reply to this email.</p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
