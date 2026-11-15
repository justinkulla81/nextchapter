import { Font, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ResumeTemplateStyleTokens } from '../style-tokens'
import { spaceBeforeHeadingPt } from '../style-tokens'

// react-pdf's Page size="LETTER" constant already resolves to US Letter,
// so unlike the docx renderer there's no A4-default footgun here — but we
// still pass it explicitly on every template for parity/readability.
export const PDF_PAGE_SIZE = 'LETTER' as const

// react-pdf breaks long words across lines with a hyphen by default, and the hyphen lands in the text layer:
// an applicant tracking system then reads "custom-" and "ers" instead of "customers". Returning the word whole
// turns that off, so a word that does not fit moves to the next line instead.
Font.registerHyphenationCallback((word) => [word])

// @react-pdf/renderer is restricted to the 14 standard PDF fonts here
// (Helvetica/Times-Roman/Courier families) so nothing needs Font.register
// at render time — no network fetch, no bundling a font file, no risk of
// a missing weight. Bold/italic variants are addressed by fontFamily
// suffix, matching react-pdf's built-in font map.
export function pdfHeadingStyle(tokens: ResumeTemplateStyleTokens, accentColor: string | null) {
  return StyleSheet.create({
    heading: {
      fontFamily: tokens.pdfFontFamily,
      fontWeight: tokens.headingBold ? 700 : 400,
      fontSize: tokens.headingSizePt,
      color: tokens.headingUsesAccent && accentColor ? `#${accentColor}` : '#111111',
      marginTop: spaceBeforeHeadingPt(tokens),
      marginBottom: tokens.spaceAfterHeadingPt,
      // A thin rule under the heading, for the templates that set it.
      ...(tokens.headingRule ? { borderBottomWidth: 0.6, borderBottomColor: '#777777', paddingBottom: 2 } : {}),
      // No letterSpacing set — omission is deliberate, this is the "no
      // letter-spacing on headings" rule (§13.2) satisfied by construction.
    },
  }).heading
}

export function SectionHeading({
  text,
  tokens,
  accentColor,
}: {
  text: string
  tokens: ResumeTemplateStyleTokens
  accentColor: string | null
}) {
  const label = tokens.headingCase === 'uppercase' ? text.toUpperCase() : text
  return <Text style={pdfHeadingStyle(tokens, accentColor)}>{label}</Text>
}

// Left label + right-aligned date. A flex row with space-between is the
// PDF-renderer analog of the docx PositionalTab right tab stop — it is
// neither literal spaces nor a table, and it stays a single visual column
// (one row, two ends), matching §13.2's "never spaces, never tables" rule
// for date alignment.
export function LabelWithRightDate({
  left,
  dateLabel,
  tokens,
  italicRight,
}: {
  left: React.ReactNode
  dateLabel: string
  tokens: ResumeTemplateStyleTokens
  italicRight?: boolean
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      {/* flexBasis: 0 (not the "auto" default) is required here — without
          it, Yoga sizes this column by its text content first and only
          grows/shrinks afterward, which lets a long role title run under
          the date column instead of wrapping to stay clear of it. */}
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingRight: 8 }}>{left}</View>
      <Text
        style={{
          fontFamily: tokens.pdfFontFamily,
          fontSize: tokens.bodySizePt,
          flexShrink: 0,
          textAlign: 'right',
          ...(italicRight ? { fontStyle: 'italic' as const } : {}),
        }}
      >
        {dateLabel}
      </Text>
    </View>
  )
}

export function BodyText({
  text,
  tokens,
  italics,
  marginBottom,
}: {
  text: string
  tokens: ResumeTemplateStyleTokens
  italics?: boolean
  marginBottom?: number
}) {
  return (
    <Text
      style={{
        fontFamily: tokens.pdfFontFamily,
        fontStyle: italics ? 'italic' : 'normal',
        fontSize: tokens.bodySizePt,
        marginBottom: marginBottom ?? tokens.spaceAfterParagraphPt,
        lineHeight: 1.35,
      }}
    >
      {text}
    </Text>
  )
}

// Bullet rendered as an ordinary character prefix, not a numbering XML
// element — unlike the docx renderer, PDF text has no "numbering" concept
// to abuse in the first place, and a literal "•" glyph here carries none
// of the docx-specific re-flow risk the skill warns about (mammoth/ATS
// text extraction reads it as a plain character either way).
export function BulletText({ text, tokens }: { text: string; tokens: ResumeTemplateStyleTokens }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
      <Text style={{ fontFamily: tokens.pdfFontFamily, fontSize: tokens.bodySizePt, width: 12 }}>•</Text>
      <Text style={{ fontFamily: tokens.pdfFontFamily, fontSize: tokens.bodySizePt, flex: 1, lineHeight: 1.35 }}>
        {text}
      </Text>
    </View>
  )
}
