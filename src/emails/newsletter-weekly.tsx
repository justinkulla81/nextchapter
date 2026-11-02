import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface NewsletterWeeklyEmailProps {
  introCopy: string | null
  articleTitle: string
  articleUrl: string
  articleSummary: string | null
  newsUrl: string
  signupUrl: string
  unsubscribeUrl: string
}

/**
 * The Tuesday email for people who signed up on the site without an
 * account: the same article the candidate digest carries, without the
 * personal market numbers that need a profile to compute.
 */
export default function NewsletterWeeklyEmail({
  introCopy, articleTitle, articleUrl, articleSummary, newsUrl, signupUrl, unsubscribeUrl,
}: NewsletterWeeklyEmailProps) {
  const intro = introCopy || "Here's this week's read on the job market."
  return (
    <CardEmail
      preheader={articleTitle}
      audience="candidate"
      footer={
        <>
          You signed up for this email at launchyournextchapter.com.
          <br />
          <a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{intro}</Headline>
        <Lead>
          <strong>Worth a read:</strong> <a href={articleUrl}>{articleTitle}</a>
          {articleSummary && ` — ${articleSummary}`}
        </Lead>
        <Lead>
          More articles, videos and posts are on the <a href={newsUrl}>News page</a>.
        </Lead>
        <Lead>
          Searching for a job yourself? NextChapter is free for candidates: a Market Reality Assessment, a resume tested against the systems
          that read it, and a plan for the week.
        </Lead>
        <Button href={signupUrl}>Get your Market Reality Assessment</Button>
      </Card>
    </CardEmail>
  )
}
