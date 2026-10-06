import { emailStyles } from '@/lib/email/email-styles'

interface NewsletterWeeklyEmailProps {
  introCopy: string | null
  articleTitle: string
  articleUrl: string
  articleSummary: string | null
  newsUrl: string
  signupUrl: string
  unsubscribeUrl: string
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

const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

/**
 * The Tuesday email for people who signed up on the site without an
 * account: the same article the candidate digest carries, without the
 * personal market numbers that need a profile to compute.
 */
export default function NewsletterWeeklyEmail({
  introCopy, articleTitle, articleUrl, articleSummary, newsUrl, signupUrl, unsubscribeUrl,
}: NewsletterWeeklyEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>{introCopy || "Here's this week's read on the job market."}</p>
      <p>
        <strong>Worth a read:</strong> <a href={articleUrl}>{articleTitle}</a>
        {articleSummary && ` — ${articleSummary}`}
      </p>
      <p>
        More articles, videos and posts are on the <a href={newsUrl}>News page</a>.
      </p>
      <p>
        Searching for a job yourself? NextChapter is free for candidates: a Market Reality Assessment, a resume tested against
        the systems that read it, and a plan for the week.
      </p>
      <a href={signupUrl} style={button}>
        Get your Market Reality Assessment →
      </a>
      <p style={footer}>
        You signed up for this email at launchyournextchapter.com. <a href={unsubscribeUrl}>Unsubscribe</a>
      </p>
    </div>
  )
}
