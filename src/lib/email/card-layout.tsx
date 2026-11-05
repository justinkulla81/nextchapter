import type { CSSProperties, ReactNode } from 'react'
import { AudienceTag, type EmailAudience } from '@/lib/email/audience-tag'
import { withEmailUtm } from '@/lib/email/utm'

// The NextChapter card email look: grey page, white rounded cards, a wordmark,
// one big headline, an optional hero number card, one green pill button, and
// optional feature rows. Table layout and inline styles only, so it renders the
// same in Gmail and Outlook. Every card-style email builds from these parts.

export const CARD_FONT = '"Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
export const INK = '#202124'
export const MUTED = '#5f6368'
export const BRAND = '#0b2545'
export const GREEN = '#2e7d5b'

// Warm paper card with a faint edge, so the email reads as a page in a chapter, not a form.
export const PAPER = '#fffdf8'
const PAPER_EDGE = '#ece4d4'
const card: CSSProperties = { backgroundColor: PAPER, border: `1px solid ${PAPER_EDGE}`, borderRadius: '24px' }
// Gmail ignores web fonts, so the display face only shows in Apple Mail and similar; everywhere else it falls back to CARD_FONT.
export const DISPLAY_FONT = '"Bricolage Grotesque", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
const HAND_FONT = '"Caveat", "Bradley Hand", "Segoe Print", cursive'

/** Absolute URL of a file in public/email, so the image loads inside a mail client. */
export function emailAsset(file: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com').replace(/\/$/, '')
  return `${base}/email/${file}`
}
const gapStyle: CSSProperties = { height: '12px', lineHeight: '12px', fontSize: '12px' }

function Gap() {
  return (
    <tr>
      <td style={gapStyle}>&nbsp;</td>
    </tr>
  )
}

/** Page shell: grey background, 640px column, hidden preheader, footer with audience tag. */
export function CardEmail({
  preheader,
  audience,
  footer,
  children,
}: {
  preheader?: string
  audience: EmailAudience
  /** Small print under the cards (why they got this, unsubscribe link). */
  footer?: ReactNode
  /** <Card> and <CardGap /> elements. */
  children: ReactNode
}) {
  return (
    <div style={{ backgroundColor: '#f1f3f4', padding: '24px 12px', fontFamily: CARD_FONT, color: INK }}>
      {preheader && <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden', opacity: 0 }}>{preheader}</div>}
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: '640px', margin: '0 auto' }}>
        <tbody>
          {children}
          <tr>
            <td style={{ padding: '20px 12px 0', textAlign: 'center', fontSize: '13px', lineHeight: '1.6', color: MUTED }}>
              {footer}
              <AudienceTag audience={audience} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** One white rounded card (a table row). */
export function Card({ children, center = false, pad = '28px 32px' }: { children: ReactNode; center?: boolean; pad?: string }) {
  return (
    <tr>
      <td style={{ ...card, padding: pad, textAlign: center ? 'center' : 'left' }}>{children}</td>
    </tr>
  )
}

/** Vertical space between cards. */
export function CardGap() {
  return <Gap />
}

/** The bookmark mark and the name. The mark is an image; the name stays text so it survives blocked images. */
export function Wordmark() {
  return (
    <p style={{ margin: '0 0 28px', fontFamily: DISPLAY_FONT, fontSize: '22px', fontWeight: 800, color: BRAND, letterSpacing: '-0.01em' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={emailAsset('bookmark.png')} width={18} height={26} alt="" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px', border: 0 }} />
      <span style={{ verticalAlign: 'middle' }}>NextChapter</span>
    </p>
  )
}

/** Orange highlighter under a number or phrase that matters. Counts only; never on something clickable. */
export function Mark({ children }: { children: ReactNode }) {
  return <span style={{ backgroundColor: '#f9d9b4', padding: '0 3px' }}>{children}</span>
}

/** A short handwritten aside. Falls back to a plain italic where the hand font is missing. */
export function MarginNote({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 0 20px', fontFamily: HAND_FONT, fontSize: '22px', lineHeight: '1.2', fontWeight: 700, color: '#1d4e89' }}>{children}</p>
}

/** Victoria's handwritten sign-off, then an optional P.S. The name picks the image; the alt text keeps it readable with images off. */
export function Signoff({ name = 'Victoria', ps, align = 'left' }: { name?: 'Victoria' | 'Vicki' | 'Vic'; ps?: ReactNode; align?: 'left' | 'center' }) {
  return (
    <div style={{ margin: '20px 0 0', textAlign: align }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={emailAsset(`signature-${name.toLowerCase()}.png`)} height={49} alt={name} style={{ display: 'inline-block', height: '49px', width: 'auto', border: 0 }} />
      {ps && <p style={{ margin: '8px 0 0', fontSize: '15px', lineHeight: '1.6', color: MUTED }}>P.S. {ps}</p>}
    </div>
  )
}

export function Headline({ children }: { children: ReactNode }) {
  return <h1 style={{ margin: '0 0 24px', fontFamily: DISPLAY_FONT, fontSize: '30px', lineHeight: '1.2', fontWeight: 800, color: BRAND, letterSpacing: '-0.01em' }}>{children}</h1>
}

/** Big number on a pale blue card, with a caption under it. */
export function Hero({ value, caption }: { value: string; caption: string }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '0 0 28px' }}>
      <tbody>
        <tr>
          <td style={{ backgroundColor: '#e8f0f8', borderRadius: '20px', padding: '36px 24px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '64px', lineHeight: '1', fontWeight: 700, color: BRAND }}>{value}</p>
            <p style={{ margin: '10px 0 0', fontSize: '16px', color: MUTED }}>{caption}</p>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Centered body paragraph under the headline or hero. */
export function Lead({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 auto 28px', maxWidth: '500px', fontSize: '17px', lineHeight: '1.6', color: INK }}>{children}</p>
}

/** Left-aligned body paragraph for text-heavy cards. */
export function Body({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 0 16px', fontSize: '16px', lineHeight: '1.6', color: INK }}>{children}</p>
}

export function Small({ children }: { children: ReactNode }) {
  return <p style={{ margin: '12px 0 0', fontSize: '14px', color: MUTED }}>{children}</p>
}

/** The green pill button. A link to our own site gets email UTM tags so the visit shows as Email in PostHog; `campaign` names the email. */
export function Button({ href, children, campaign = 'unlabeled', ctaVariant }: { href: string; children: ReactNode; campaign?: string; ctaVariant?: string }) {
  let link = withEmailUtm(href, campaign)
  // The assessment label test: tag the link with the arm so a visit shows which label brought it.
  if (ctaVariant && link !== href) link = `${link}&utm_content=cta_${ctaVariant}`
  return (
    <a href={link} style={{ display: 'inline-block', padding: '14px 28px', backgroundColor: GREEN, color: '#ffffff', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '16px' }}>
      {children}
    </a>
  )
}

/** Title and text on the left, a green tile on the right. */
export function FeatureRow({ title, body, tile }: { title: string; body: string; tile: string }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'middle', paddingRight: '20px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 700, color: INK }}>{title}</p>
            <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.6', color: MUTED }}>{body}</p>
          </td>
          <td width={150} style={{ verticalAlign: 'middle', textAlign: 'center', backgroundColor: '#e6f2ec', borderRadius: '16px', padding: '28px 8px', fontSize: '16px', fontWeight: 700, color: GREEN }}>
            {tile}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Label and value rows on a pale card, for facts like a role, a place or a date. */
export function FactList({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '0 0 28px' }}>
      <tbody>
        <tr>
          <td style={{ backgroundColor: '#e8f0f8', borderRadius: '20px', padding: '20px 24px', textAlign: 'left' }}>
            {rows.map((r) => (
              <p key={r.label} style={{ margin: '6px 0', fontSize: '16px', lineHeight: '1.5', color: INK }}>
                <span style={{ color: MUTED }}>{r.label}: </span>
                <strong>{r.value}</strong>
              </p>
            ))}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
