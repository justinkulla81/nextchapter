import { Button, Card, CardEmail, Headline, Lead, MUTED, Small, Wordmark } from '@/lib/email/card-layout'

export interface RoleNetworkDigestPost {
  author: string
  excerpt: string
}

interface RoleNetworkDigestEmailProps {
  firstName: string | null
  short: string
  spelled: string
  openJobs: number | null
  medianPay: string | null
  posts: RoleNetworkDigestPost[]
  rolePageUrl: string
  networkUrl: string
  unsubscribeUrl: string
}

export default function RoleNetworkDigestEmail({
  firstName,
  short,
  spelled,
  openJobs,
  medianPay,
  posts,
  rolePageUrl,
  networkUrl,
  unsubscribeUrl,
}: RoleNetworkDigestEmailProps) {
  return (
    <CardEmail
      preheader={`This week in the ${short} network.`}
      audience="candidate"
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Unsubscribe from weekly digests
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Hi {firstName || 'there'}, this week in the {short} network.</Headline>
        {openJobs !== null && (
          <Lead>
            <strong>{openJobs.toLocaleString('en-US')}</strong> verified open {spelled} jobs right now
            {medianPay ? <>, with a median advertised pay of <strong>{medianPay}</strong> among listings that state it</> : null}. <a href={rolePageUrl}>See the {short} page</a>.
          </Lead>
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
            <Button campaign="role_network_digest" href={networkUrl}>Open the {short} network</Button>
          </>
        )}
        {posts.length === 0 && <Small>You are getting this because you joined the {short} network.</Small>}
      </Card>
    </CardEmail>
  )
}
