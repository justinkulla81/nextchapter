import { Button, Card, CardEmail, Headline, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface FirmJoinedEmailProps {
  firstName: string | null
  firms: string[]
  packageUrl: string
}

/** A search firm the member picked has joined NextChapter. Nothing was sent to it; the member decides. */
export default function FirmJoinedEmail({ firstName, firms, packageUrl }: FirmJoinedEmailProps) {
  const one = firms.length === 1
  const names = one ? firms[0] : `${firms.length} firms you picked`
  return (
    <CardEmail
      audience="candidate"
      preheader={`${names} ${one ? 'has' : 'have'} joined. Your résumé has not been sent.`}
      footer={
        <>
          You get this once for each firm you picked, when it joins. Nothing has been sent to the firm.{' '}
          <a href={packageUrl} style={{ color: MUTED }}>Change the firms you picked</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Hi {firstName || 'there'}, {one ? `${firms[0]} has joined NextChapter.` : `${firms.length} firms you picked have joined NextChapter.`}</Headline>
        {!one && (
          <div style={{ textAlign: 'left', margin: '0 0 16px' }}>
            {firms.map((f, i) => (
              <p key={i} style={{ margin: '0 0 6px', fontSize: '16px', lineHeight: '1.5', color: INK }}>{f}</p>
            ))}
          </div>
        )}
        <Lead>Your résumé has not been sent. It goes only when you choose to send it.</Lead>
        <Button campaign="firm_joined" href={packageUrl}>Review and send my résumé</Button>
      </Card>
    </CardEmail>
  )
}
