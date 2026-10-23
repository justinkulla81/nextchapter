import { AudienceTag } from '@/lib/email/audience-tag'
import type { OfferCopy } from '@/lib/upgrade-offer/triggers'

interface UpgradeOfferEmailProps {
  copy: OfferCopy
  planName: string
  ctaUrl: string
  unsubscribeUrl: string
}

const FONT = '"Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
const INK = '#202124'
const MUTED = '#5f6368'
const BRAND = '#0b2545'
const GREEN = '#2e7d5b'

const card: React.CSSProperties = { backgroundColor: '#ffffff', borderRadius: '24px' }

// A big white-card layout in the style of a product-upgrade email: wordmark,
// one large headline, a hero card showing the member's own number, one button,
// then three short benefit rows (title, description, tile), and a closing button.
// Table layout and inline styles only, so it renders the same in Gmail and Outlook.
export default function UpgradeOfferEmail({ copy, planName, ctaUrl, unsubscribeUrl }: UpgradeOfferEmailProps) {
  return (
    <div style={{ backgroundColor: '#f1f3f4', padding: '24px 12px', fontFamily: FONT, color: INK }}>
      <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden', opacity: 0 }}>{copy.preheader}</div>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: '640px', margin: '0 auto' }}>
        <tbody>
          <tr>
            <td style={{ ...card, padding: '28px 32px 36px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 28px', fontSize: '22px', fontWeight: 700, color: BRAND, letterSpacing: '-0.01em' }}>NextChapter</p>
              <h1 style={{ margin: '0 0 24px', fontSize: '30px', lineHeight: '1.25', fontWeight: 700, color: INK }}>{copy.headline}</h1>

              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '0 0 28px' }}>
                <tbody>
                  <tr>
                    <td style={{ backgroundColor: '#e8f0f8', borderRadius: '20px', padding: '36px 24px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '64px', lineHeight: '1', fontWeight: 700, color: BRAND }}>{copy.hero.value}</p>
                      <p style={{ margin: '10px 0 0', fontSize: '16px', color: MUTED }}>{copy.hero.caption}</p>
                    </td>
                  </tr>
                </tbody>
              </table>

              <p style={{ margin: '0 auto 28px', maxWidth: '500px', fontSize: '17px', lineHeight: '1.6', color: INK }}>{copy.intro}</p>
              <a href={ctaUrl} style={{ display: 'inline-block', padding: '14px 28px', backgroundColor: GREEN, color: '#ffffff', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '16px' }}>
                See {planName}
              </a>
              <p style={{ margin: '12px 0 0', fontSize: '14px', color: MUTED }}>Cancel anytime.</p>
            </td>
          </tr>

          <tr><td style={{ height: '12px', lineHeight: '12px', fontSize: '12px' }}>&nbsp;</td></tr>

          {copy.features.map((f) => (
            <tr key={f.title}>
              <td style={{ ...card, padding: '28px 32px' }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td style={{ verticalAlign: 'middle', paddingRight: '20px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 700, color: INK }}>{f.title}</p>
                        <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.6', color: MUTED }}>{f.body}</p>
                      </td>
                      <td width={150} style={{ verticalAlign: 'middle', textAlign: 'center', backgroundColor: '#e6f2ec', borderRadius: '16px', padding: '28px 8px', fontSize: '16px', fontWeight: 700, color: GREEN }}>
                        {f.tile}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          )).flatMap((row, i) => [row, <tr key={`gap-${i}`}><td style={{ height: '12px', lineHeight: '12px', fontSize: '12px' }}>&nbsp;</td></tr>])}

          <tr>
            <td style={{ ...card, padding: '32px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 16px', fontSize: '19px', fontWeight: 700 }}>Not now? That is fine.</p>
              <p style={{ margin: '0 0 20px', fontSize: '16px', lineHeight: '1.6', color: MUTED }}>Everything you use today stays free. Reply to this email if you have a question and a person will answer.</p>
              <a href={ctaUrl} style={{ display: 'inline-block', padding: '14px 28px', backgroundColor: GREEN, color: '#ffffff', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '16px' }}>
                See {planName}
              </a>
            </td>
          </tr>

          <tr>
            <td style={{ padding: '20px 12px 0', textAlign: 'center', fontSize: '13px', lineHeight: '1.6', color: MUTED }}>
              You are getting this because of your numbers in NextChapter. We send at most one of these every three weeks.
              <br />
              <a href={unsubscribeUrl} style={{ color: MUTED }}>Stop these emails</a>
              <AudienceTag audience="candidate" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
