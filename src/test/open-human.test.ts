import { describe, expect, it } from 'vitest'
import { humanOpenCount } from '@/lib/mailing/open-human'

const t = (s: number) => new Date(Date.UTC(2026, 10, 11, 15, 0, s))
const o = (openedAt: number | null, openCount: number) => ({ sentAt: t(0), deliveredAt: t(5), openedAt: openedAt === null ? null : t(openedAt), openCount })

describe('humanOpenCount', () => {
  it('drops a single open that came seconds after delivery', () => expect(humanOpenCount(o(8, 1))).toBe(0))
  it('keeps later opens when the first was a prefetch', () => expect(humanOpenCount(o(8, 3))).toBe(2))
  it('counts every open when the first came well after delivery', () => expect(humanOpenCount(o(3600, 2))).toBe(2))
  it('is zero with no open', () => expect(humanOpenCount(o(null, 0))).toBe(0))
})
