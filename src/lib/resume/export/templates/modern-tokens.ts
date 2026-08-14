import type { ResumeTemplateStyleTokens } from '../style-tokens'

// See classic-tokens.ts's header comment for why this data lives apart
// from modern.ts's docx/PDF build functions.
//
// Modern — sans-serif, title-case headings carried in the accent color,
// slightly tighter margins than Classic. Aimed at tech/product/startup
// candidates who want something that reads as current without tipping
// into anything a parser would choke on.
export const modernTokens: ResumeTemplateStyleTokens = {
  id: 'modern',
  name: 'Modern',
  description: 'Clean sans-serif resume with color-accented headings — a current, tech-forward look.',
  defaultAccentColor: '0F766E', // teal

  docxFontFamily: 'Calibri',
  pdfFontFamily: 'Helvetica',

  nameSizePt: 24,
  targetTitleSizePt: 12.5,
  headingSizePt: 11.5,
  bodySizePt: 10.5,
  contactSizePt: 9.5,

  headingCase: 'none', // title case, as typed ("Experience", not "EXPERIENCE")
  headingBold: true,
  headingUsesAccent: true, // headings pick up the accent color; name does too

  marginInches: 0.85,

  spaceAfterHeadingPt: 6.4, // before = 16pt (2.5x)
  spaceAfterParagraphPt: 6,
}
