import { Button, Card, CardEmail, Headline, Lead, Small, Wordmark } from '@/lib/email/card-layout'

interface DocumentRequestedEmailProps {
  requesterLabel: string
  title: string
  instructions: string | null
  dueLabel: string | null
  uploadUrl: string
}

export default function DocumentRequestedEmail({ requesterLabel, title, instructions, dueLabel, uploadUrl }: DocumentRequestedEmailProps) {
  return (
    <CardEmail preheader={`${requesterLabel} asked you for a document: ${title}`} audience="candidate">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          {requesterLabel} asked you for a document: {title}
        </Headline>
        {dueLabel ? <Lead>They would like it by {dueLabel}.</Lead> : null}
        {instructions ? (
          <p style={{ margin: '0 auto 28px', maxWidth: '500px', fontSize: '17px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{instructions}</p>
        ) : null}
        <Button href={uploadUrl}>Upload the document</Button>
        <Small>You can upload from your NextChapter dashboard under Documents. If you were not expecting this, you can ignore this email.</Small>
      </Card>
    </CardEmail>
  )
}
