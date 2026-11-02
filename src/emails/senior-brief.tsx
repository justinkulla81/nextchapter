import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'
import type { ItemKind } from '@/lib/senior-brief/rules'

interface SeniorBriefEmailProps {
  firstName: string | null
  itemKind: ItemKind
  contactName: string
  companyName: string | null
  openUrl: string
  /** null in a test send, where the member's own links must not be live. */
  unsubscribeUrl: string | null
  notForMeUrl: string | null
  /** Test sends only: the draft as saved, so it can be reviewed. */
  testDraft?: { subject: string; body: string; toEmail: string; memberId: string } | null
}

export function seniorBriefHeadline(kind: ItemKind, contactName: string, companyName: string | null): string {
  if (kind === 'recruiter_follow_up') return `A follow-up to ${contactName} is ready`
  return companyName ? `A note to ${contactName} at ${companyName} is ready` : `A note to ${contactName} is ready`
}

export function seniorBriefReason(kind: ItemKind, contactName: string, companyName: string | null): string {
  if (kind === 'recruiter_follow_up') return `You spoke with ${contactName} a few weeks ago and nothing has gone out since.`
  return `${contactName}${companyName ? ` works at ${companyName}, which is on your watchlist` : ' is on your watchlist'}, and is the warmest contact you have there.`
}

// One item, one button. Plain table layout and inline styles, like the other member emails.
export default function SeniorBriefEmail({ firstName, itemKind, contactName, companyName, openUrl, unsubscribeUrl, notForMeUrl, testDraft }: SeniorBriefEmailProps) {
  return (
    <CardEmail
      audience="candidate"
      preheader={seniorBriefHeadline(itemKind, contactName, companyName)}
      footer={
        unsubscribeUrl && notForMeUrl ? (
          <>
            <a href={notForMeUrl} style={{ color: MUTED }}>Not for me: pause for 90 days</a>
            {' · '}
            <a href={unsubscribeUrl} style={{ color: MUTED }}>Stop this email</a>
          </>
        ) : (
          <span>Unsubscribe links are switched off in test sends.</span>
        )
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        {testDraft ? (
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#b3261e' }}>Test send to you only. Nothing was written to the member&apos;s Gmail. Draft for member {testDraft.memberId}.</p>
        ) : null}
        <p style={{ margin: '0 0 16px', fontSize: '15px', color: MUTED }}>{firstName ? `Good morning, ${firstName}.` : 'Good morning.'}</p>
        <Headline>{seniorBriefHeadline(itemKind, contactName, companyName)}</Headline>
        <Lead>
          {seniorBriefReason(itemKind, contactName, companyName)} We wrote the message from what you have saved. Open it and it is ready to send from your own Gmail. Nothing is sent until you press send.
        </Lead>
        <Button href={openUrl}>Open your message</Button>
        {testDraft ? (
          <div style={{ marginTop: '28px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            <strong>To:</strong> {testDraft.toEmail}
            {'\n'}
            <strong>Subject:</strong> {testDraft.subject}
            {'\n\n'}
            {testDraft.body}
          </div>
        ) : null}
      </Card>
    </CardEmail>
  )
}
