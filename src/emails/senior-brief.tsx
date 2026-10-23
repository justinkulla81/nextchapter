import { AudienceTag } from '@/lib/email/audience-tag'
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

const FONT = '"Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
const INK = '#202124'
const MUTED = '#5f6368'

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
    <div style={{ backgroundColor: '#f1f3f4', padding: '24px 12px', fontFamily: FONT, color: INK }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: '560px', margin: '0 auto' }}>
        <tbody>
          <tr>
            <td style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px 32px 32px' }}>
              {testDraft ? (
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#b3261e' }}>Test send to you only. Nothing was written to the member&apos;s Gmail. Draft for member {testDraft.memberId}.</p>
              ) : null}
              <p style={{ margin: '0 0 20px', fontSize: '15px', color: MUTED }}>{firstName ? `Good morning, ${firstName}.` : 'Good morning.'}</p>
              <h1 style={{ margin: '0 0 12px', fontSize: '24px', lineHeight: '1.3', fontWeight: 700 }}>{seniorBriefHeadline(itemKind, contactName, companyName)}</h1>
              <p style={{ margin: '0 0 24px', fontSize: '16px', lineHeight: '1.6' }}>
                {seniorBriefReason(itemKind, contactName, companyName)} We wrote the message from what you have saved. Open it and it is ready to send from your own Gmail. Nothing is sent until you press send.
              </p>
              <a href={openUrl} style={{ display: 'inline-block', padding: '14px 28px', backgroundColor: '#2e7d5b', color: '#ffffff', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '16px' }}>
                Open your message
              </a>
              {testDraft ? (
                <div style={{ marginTop: '28px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  <strong>To:</strong> {testDraft.toEmail}
                  {'\n'}
                  <strong>Subject:</strong> {testDraft.subject}
                  {'\n\n'}
                  {testDraft.body}
                </div>
              ) : null}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '20px 12px 0', textAlign: 'center', fontSize: '13px', lineHeight: '1.6', color: MUTED }}>
              {unsubscribeUrl && notForMeUrl ? (
                <>
                  <a href={notForMeUrl} style={{ color: MUTED }}>Not for me: pause for 90 days</a>
                  {' · '}
                  <a href={unsubscribeUrl} style={{ color: MUTED }}>Stop this email</a>
                </>
              ) : (
                <span>Unsubscribe links are switched off in test sends.</span>
              )}
              <AudienceTag audience="candidate" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
