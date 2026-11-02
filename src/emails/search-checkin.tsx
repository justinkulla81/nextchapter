import type { CSSProperties } from 'react'
import EngagementBlock from '@/emails/engagement-block'
import type { EngagementLead } from '@/lib/journey/engagement'
import { Button, Card, CardEmail, GREEN, Headline, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface SearchCheckInEmailProps {
  engagement?: EngagementLead | null
  appUrl?: string
  firstName: string | null
  introCopy?: string | null
  stillSearchingUrl: string
  managingMyCareerUrl: string
  gotAnOfferUrl: string
  pixelUrl: string
  unsubscribeUrl: string
}

// Quieter outlined pills for the secondary answers.
const outlined: CSSProperties = {
  display: 'inline-block',
  padding: '12px 26px',
  border: '1.5px solid #dadce0',
  color: INK,
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '16px',
}
const outlinedGreen: CSSProperties = { ...outlined, borderColor: GREEN, color: GREEN }

// Saturday's check-in — a single question with three answers, each its own
// no-login link (/api/checkin/[token]) so answering takes one click, not a
// form. See overlap with Sunday's Finish Line email, which now carries the
// old "week in review" content this replaces on Saturday.
export default function SearchCheckInEmail({
  engagement = null,
  appUrl = '',
  firstName,
  introCopy,
  stillSearchingUrl,
  managingMyCareerUrl,
  gotAnOfferUrl,
  pixelUrl,
  unsubscribeUrl,
}: SearchCheckInEmailProps) {
  return (
    <CardEmail
      preheader="One click tells us where you are."
      audience="candidate"
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Turn off these weekly nudges
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Has anything changed{firstName ? `, ${firstName}` : ''}?</Headline>
        <Lead>
          One click tells us where you are, and your plan and our emails follow it right away. Something else changed, like a
          layoff or a new job? Update your situation in NextChapter.
        </Lead>
        {introCopy && <Lead>{introCopy}</Lead>}
        <div style={{ textAlign: 'left', margin: '0 0 28px' }}>
          <EngagementBlock lead={engagement} appUrl={appUrl} />
        </div>
        <Button href={stillSearchingUrl}>Nothing yet</Button>
        <div style={{ height: '12px', lineHeight: '12px', fontSize: '12px' }}>&nbsp;</div>
        <a href={managingMyCareerUrl} style={outlined}>
          Not looking right now: managing my career
        </a>
        <div style={{ height: '12px', lineHeight: '12px', fontSize: '12px' }}>&nbsp;</div>
        <a href={gotAnOfferUrl} style={outlinedGreen}>
          Got an offer! 🎉
        </a>
      </Card>
      {/* Best-effort open signal — many mail clients block remote images by
          default, so this undercounts opens rather than overcounting. */}
      <tr>
        <td style={{ height: 0, lineHeight: 0, fontSize: 0 }}>
          <img src={pixelUrl} width={1} height={1} alt="" style={{ display: 'none' }} />
        </td>
      </tr>
    </CardEmail>
  )
}
