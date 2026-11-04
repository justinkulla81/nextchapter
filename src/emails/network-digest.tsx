import { Button, Card, CardEmail, Headline, Lead, MUTED, Small, Wordmark } from '@/lib/email/card-layout'

export interface NetworkDigestPost {
  author: string
  excerpt: string
}

interface NetworkDigestEmailProps {
  firstName: string | null
  /** "CRO", "Sales", "Health care" */
  name: string
  /** What the open-jobs line is about: "Chief Revenue Officer", "Sales", "Health care". */
  scope: string
  openJobs: number | null
  medianPay: string | null
  posts: NetworkDigestPost[]
  /** What is new around a role this week, one plain line each. */
  highlights?: string[]
  /** Why the member is getting this, finishing "You are getting this because ...". */
  because: string
  pageUrl: string
  pageLabel: string
  networkUrl: string
  unsubscribeUrl: string
}

export default function NetworkDigestEmail({
  firstName,
  name,
  scope,
  openJobs,
  medianPay,
  posts,
  highlights = [],
  because,
  pageUrl,
  pageLabel,
  networkUrl,
  unsubscribeUrl,
}: NetworkDigestEmailProps) {
  return (
    <CardEmail
      preheader={`This week in the ${name} network.`}
      audience="candidate"
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Unsubscribe from weekly digests
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Hi {firstName || 'there'}, this week in the {name} network.</Headline>
        {openJobs !== null && (
          <Lead>
            <strong>{openJobs.toLocaleString('en-US')}</strong> verified open {scope} jobs right now
            {medianPay ? <>, with a median advertised pay of <strong>{medianPay}</strong> among listings that state it</> : null}. <a href={pageUrl}>{pageLabel}</a>.
          </Lead>
        )}
        {highlights.length > 0 && (
          <>
            <Lead>
              <strong>Around the {name} role</strong>
            </Lead>
            {highlights.map((h) => (
              <Lead key={h}>{h}.</Lead>
            ))}
            <Button campaign="network_digest" href={pageUrl}>{pageLabel}</Button>
          </>
        )}
        {posts.length > 0 && (
          <>
            <Lead>
              <strong>What other members posted</strong>
            </Lead>
            {posts.map((p, i) => (
              <Lead key={i}>
                <strong>{p.author}:</strong> {p.excerpt}
              </Lead>
            ))}
            <Button campaign="network_digest" href={networkUrl}>Open the {name} network</Button>
          </>
        )}
        <Small>You are getting this because {because}. Unsubscribe below to stop it.</Small>
      </Card>
    </CardEmail>
  )
}
