import { describe, it, expect } from 'vitest'
import { deflateSync } from 'zlib'
import { pdfText, labelledNumber } from '@/lib/warn/pdf'

/** Wraps content-stream operators in the smallest thing pdfText will read. */
function makePdf(content: string): Buffer {
  const body = deflateSync(Buffer.from(content, 'latin1'))
  return Buffer.concat([
    Buffer.from('%PDF-1.6\n4 0 obj\n<</Length 0/Filter/FlateDecode>>stream\n', 'latin1'),
    body,
    Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
  ])
}

describe('pdfText', () => {
  it('reads literal strings out of a content stream', () => {
    const pdf = makePdf('BT /F1 12 Tf (Number of Affected Workers: ) Tj (28) Tj ET')
    expect(pdfText(pdf)).toContain('Number of Affected Workers')
    expect(pdfText(pdf)).toContain('28')
  })

  it('reads hex strings, which some generators use instead', () => {
    // 48656c6c6f = "Hello"
    expect(pdfText(makePdf('BT <48656c6c6f> Tj ET'))).toContain('Hello')
  })

  it('handles escapes and nested parentheses without truncating', () => {
    const pdf = makePdf(String.raw`BT (Acme \(US\) Inc.) Tj (a\\b) Tj ET`)
    const text = pdfText(pdf)
    expect(text).toContain('Acme (US) Inc.')
    expect(text).toContain('a\\b')
  })

  it('decodes octal escapes', () => {
    // \101 is "A"
    expect(pdfText(makePdf(String.raw`BT (\101BC) Tj ET`))).toContain('ABC')
  })

  it('returns empty rather than throwing on a file with no readable stream', () => {
    expect(pdfText(Buffer.from('%PDF-1.4 no streams here'))).toBe('')
  })

  it('does not mistake a dictionary opener for a hex string', () => {
    expect(() => pdfText(makePdf('<</Type/Page>> BT (ok) Tj ET'))).not.toThrow()
    expect(pdfText(makePdf('<</Type/Page>> BT (ok) Tj ET'))).toContain('ok')
  })
})

describe('labelledNumber', () => {
  it('finds a number after its label', () => {
    expect(labelledNumber('Number of Affected Workers: 28', 'Number of Affected Workers')).toBe(28)
    expect(labelledNumber('Industry Type: 81 Other', 'Industry Type')).toBe(81)
  })

  it('survives the dropped spacing that PDF extraction produces', () => {
    // Real extracted text from a New York notice looks like this.
    const messy = 'N um ber of A ffec ted W ork ers :  28 T ot al'
    expect(labelledNumber(messy, 'Number of Affected Workers')).toBe(28)
  })

  it('returns null when the label is absent or has no number', () => {
    expect(labelledNumber('nothing relevant', 'Number of Affected Workers')).toBeNull()
    expect(labelledNumber('Number of Affected Workers: many', 'Number of Affected Workers')).toBeNull()
  })
})
