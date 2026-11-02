import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface BadgeEarnedEmailProps {
  firstName: string | null
  badgeLabels: string[]
  statsUrl: string
  unsubscribeUrl: string
}

export default function BadgeEarnedEmail({ firstName, badgeLabels, statsUrl, unsubscribeUrl }: BadgeEarnedEmailProps) {
  const headline =
    badgeLabels.length === 1 ? `You just earned the "${badgeLabels[0]}" badge.` : 'You just earned new badges.'
  return (
    <CardEmail
      preheader={headline}
      audience="candidate"
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Turn off these emails
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{headline}</Headline>
        <Lead>
          {firstName ? `Hi ${firstName}, ` : ''}
          real work you logged just earned {badgeLabels.length === 1 ? 'this' : 'these'}:
        </Lead>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '0 0 28px' }}>
          <tbody>
            <tr>
              <td style={{ backgroundColor: '#e6f2ec', borderRadius: '20px', padding: '20px 24px', textAlign: 'left' }}>
                <table role="presentation" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    {badgeLabels.map((label, i) => (
                      <tr key={label}>
                        <td
                          style={{
                            paddingTop: i === 0 ? 0 : '10px',
                            width: '32px',
                            height: '32px',
                            borderRadius: '9999px',
                            backgroundColor: '#d9ecdf',
                            fontSize: '16px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          🏅
                        </td>
                        <td style={{ paddingLeft: '12px', paddingTop: i === 0 ? 0 : '10px', fontSize: '16px', fontWeight: 600 }}>{label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <Button href={statsUrl}>See your badges</Button>
      </Card>
    </CardEmail>
  )
}
