import type { CSSProperties } from 'react'

export const emailStyles = {
  body: {
    fontSize: '18px',
    lineHeight: '1.8',
  } satisfies CSSProperties,
  muted: {
    color: '#4a5568',
    fontSize: '14px',
    lineHeight: '1.6',
  } satisfies CSSProperties,
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: '#1d4e89',
  } satisfies CSSProperties,
  cta: {
    fontSize: '16px',
    fontWeight: 600,
  } satisfies CSSProperties,
}
