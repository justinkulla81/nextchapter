import { Button, Card, CardEmail, Headline, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

export interface LayoffAlertEmailNotice {
  employer: string
  state: string
  place: string | null
  workers: number | null
  filedOn: string
  href: string
}

interface LayoffAlertDigestEmailProps {
  watching: string
  notices: LayoffAlertEmailNotice[]
  startUrl: string
  unsubscribeUrl: string
}

/** New WARN layoff notices for what the person is watching. Facts from the public filing only. */
export default function LayoffAlertDigestEmail({ watching, notices, startUrl, unsubscribeUrl }: LayoffAlertDigestEmailProps) {
  const headline = `${notices.length} new layoff ${notices.length === 1 ? 'notice' : 'notices'} for ${watching}`
  return (
    <CardEmail
      audience="candidate"
      preheader={headline}
      footer={
        <>
          Know someone else affected? Forward this email, or send them <a href="https://launchyournextchapter.com/?utm_source=forward" style={{ color: MUTED }}>launchyournextchapter.com</a>.
          <br />
          You get this because you asked to be told about layoff notices at launchyournextchapter.com. At most one email a day.{' '}
          <a href={unsubscribeUrl} style={{ color: MUTED }}>
            Unsubscribe
          </a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{headline}</Headline>
        <div style={{ textAlign: 'left', margin: '0 0 28px' }}>
          {notices.map((n) => (
            <p key={n.href + n.filedOn} style={{ margin: '0 0 14px', fontSize: '16px', lineHeight: '1.5', color: MUTED }}>
              <a href={n.href} style={{ fontWeight: 600, color: INK }}>
                {n.employer}
              </a>
              <br />
              {n.workers != null ? `${n.workers.toLocaleString()} workers named` : 'Worker count not published'} · {n.place ? `${n.place}, ` : ''}
              {n.state} · filed {n.filedOn}
            </p>
          ))}
        </div>
        <Lead>
          These come from the notices employers file with state labor departments. A notice gives the numbers and dates the employer reported; it does not say who is affected or why.
        </Lead>
        <Lead>If this touches you or someone you know, the first week matters most. We have a short plan, and it takes about five minutes to start.</Lead>
        <Button campaign="layoff_alert_digest" href={startUrl}>Get my laid-off game plan</Button>
      </Card>
    </CardEmail>
  )
}
