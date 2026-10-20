import type { CSSProperties } from 'react'
import type { StoryKind } from '@/lib/career-story/events'

// Look of each kind of chapter, shared by the interactive timeline and the report version.
export function barClass(kind: StoryKind, ongoing: boolean): { className: string; style?: CSSProperties } {
  switch (kind) {
    case 'SCHOOL':
      return { className: 'border border-[#9ec2e8] bg-[#cfe2f6] text-navy' }
    case 'VENTURE':
      return { className: 'border border-orange bg-[#fbdcb9] text-[#5b3300]' }
    case 'PAUSE':
      return {
        className: 'border border-dashed border-[#94a3b8] text-[#334155]',
        style: { background: 'repeating-linear-gradient(135deg,#eef2f7 0 5px,#dfe6ee 5px 10px)' },
      }
    default:
      return ongoing
        ? { className: 'border border-transparent text-white', style: { background: 'linear-gradient(90deg,#1d4e89,#2370bb)' } }
        : { className: 'border border-transparent bg-brand text-white' }
  }
}
