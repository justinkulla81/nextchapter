import type { ReactNode } from 'react'

// The frame every embeddable widget shares: a compact card with the data, and a visible link back to the full page.
// Rendered inside someone else's iframe, so it carries no site navigation and uses system fonts and inline styles only.
export function EmbedCard({ title, href, linkLabel, children, note }: { title: string; href: string; linkLabel: string; children: ReactNode; note?: string }) {
  const SITE = 'https://launchyournextchapter.com'
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', color: '#14233a', background: '#ffffff', border: '1px solid #d8dee8', borderRadius: 10, padding: 16, lineHeight: 1.45, fontSize: 14, maxWidth: 560 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#5a6a80' }}>NextChapter</div>
      <h1 style={{ fontSize: 18, margin: '2px 0 10px', fontWeight: 700 }}>{title}</h1>
      {children}
      {note && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5a6a80' }}>{note}</p>}
      <p style={{ margin: '12px 0 0' }}>
        <a href={`${SITE}${href}`} target="_blank" rel="noopener" style={{ color: '#1f5fbf', fontWeight: 600 }}>{linkLabel}</a>
      </p>
    </div>
  )
}

export const embedRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: '1px solid #eef1f6' }
