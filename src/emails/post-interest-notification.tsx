import { emailStyles } from '@/lib/email/email-styles'

interface PostInterestNotificationEmailProps {
  postTitle: string
  interestedCandidateName: string
  interestedCandidateEmail: string
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

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function PostInterestNotificationEmail({
  postTitle,
  interestedCandidateName,
  interestedCandidateEmail,
}: PostInterestNotificationEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Someone is interested in your Community Board post:</p>
      <p style={{ fontWeight: 600 }}>&quot;{postTitle}&quot;</p>
      <p>
        {interestedCandidateName} ({interestedCandidateEmail}) expressed interest. Reach out
        directly to follow up.
      </p>
      <p style={footer}>
        Your email is never shown publicly on the board — this is the only way someone can reach
        you about a post.
      </p>
    </div>
  )
}
