import { describe, expect, it } from 'vitest'
import { qrMatrix, qrSvg } from '@/lib/qr/qr-svg'

describe('qr-svg', () => {
  it('sizes the grid by version', () => {
    expect(qrMatrix('https://launchyournextchapter.com/').length).toBe(29)
    expect(qrMatrix('a'.repeat(150)).length).toBeGreaterThan(41)
  })
  it('draws the three finder patterns', () => {
    const m = qrMatrix('hello')
    const n = m.length
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      expect(m[r][c]).toBe(true)
      expect(m[r + 3][c + 3]).toBe(true)
      expect(m[r + 1][c + 1]).toBe(false)
    }
  })
  it('is deterministic', () => {
    expect(qrSvg('https://example.com/x')).toBe(qrSvg('https://example.com/x'))
  })
  it('rejects text that is too long', () => {
    expect(() => qrMatrix('a'.repeat(300))).toThrow()
  })
  it('returns an svg with the label', () => {
    const s = qrSvg('hi', { label: 'Scan me' })
    expect(s.startsWith('<svg')).toBe(true)
    expect(s).toContain('Scan me')
  })
})
