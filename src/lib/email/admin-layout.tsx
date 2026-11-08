import type { ReactNode } from 'react'

// Staff emails (alerts and digests for the NextChapter team) look nothing like member emails, so a glance at the inbox
// tells them apart: a navy "Internal" banner, a cool grey page, a square-edged white box with a navy left edge, and no
// bookmark, squiggle or paper card. Member emails use card-layout.tsx.

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
export const ADMIN_NAVY = '#0b2545'

export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ backgroundColor: '#e2e8f0', padding: '16px 12px', fontFamily: FONT, color: '#0a0a0a' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ backgroundColor: ADMIN_NAVY, color: '#ffffff', padding: '10px 16px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          <span style={{ color: '#ffffff' }}>Internal · NextChapter staff only</span>
          <span style={{ float: 'right', backgroundColor: '#fde68a', color: '#78350f', padding: '1px 8px', borderRadius: '3px', letterSpacing: '0.06em' }}>Not a member email</span>
        </div>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderLeft: `6px solid ${ADMIN_NAVY}`, padding: '20px 22px 24px', fontSize: '16px', lineHeight: '1.7' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
