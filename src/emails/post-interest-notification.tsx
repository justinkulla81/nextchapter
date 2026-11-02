import { Card, CardEmail, FactList, Headline, Lead, Small, Wordmark } from '@/lib/email/card-layout'

interface PostInterestNotificationEmailProps {
  postTitle: string
  interestedCandidateName: string
  interestedCandidateEmail: string
}

export default function PostInterestNotificationEmail({
  postTitle,
  interestedCandidateName,
  interestedCandidateEmail,
}: PostInterestNotificationEmailProps) {
  return (
    <CardEmail preheader={`Someone is interested in your Community Board post: ${postTitle}`} audience="candidate">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Someone is interested in your Community Board post</Headline>
        <FactList
          rows={[
            { label: 'Post', value: postTitle },
            { label: 'Name', value: interestedCandidateName },
            { label: 'Email', value: interestedCandidateEmail },
          ]}
        />
        <Lead>
          {interestedCandidateName} ({interestedCandidateEmail}) expressed interest. Reach out directly to follow up.
        </Lead>
        <Small>Your email is never shown publicly on the board — this is the only way someone can reach you about a post.</Small>
      </Card>
    </CardEmail>
  )
}
