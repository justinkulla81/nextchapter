import type { ResumeTemplateStyleTokens } from '../style-tokens'

// Kept in its own file, separate from classic.ts's docx/PDF build
// functions, so client components (the template picker UI) can import
// just this plain-data object without pulling `docx` or
// `@react-pdf/renderer` into the browser bundle.
//
// Classic — traditional executive resume: serif type, small-caps-style
// uppercase headings, generous 1" margins, navy by default. The most
// conservative of the three, aimed at finance/legal/traditional-industry
// candidates who want a resume that reads as unmistakably formal.
export const classicTokens: ResumeTemplateStyleTokens = {
  id: 'classic',
  name: 'Classic',
  description: 'Traditional serif resume with generous margins — the safest choice for conservative industries.',
  defaultAccentColor: '1B3A5C', // navy

  docxFontFamily: 'Georgia',
  pdfFontFamily: 'Times-Roman',

  nameSizePt: 22,
  targetTitleSizePt: 12,
  headingSizePt: 11,
  bodySizePt: 10.5,
  contactSizePt: 9.5,

  headingCase: 'uppercase',
  headingBold: true,
  headingUsesAccent: false, // headings stay ink-black; accent is reserved for the name only

  marginInches: 1,

  spaceAfterHeadingPt: 8, // before = 20pt (2.5x)
  spaceAfterParagraphPt: 6,
}
