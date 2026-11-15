import type { ResumeTemplateStyleTokens } from '../style-tokens'

// Executive — the layout most experienced professionals already use: centered name, a ruled heading per
// section, the employer in capitals with its location opposite, and the title in italics with the dates
// opposite. Still a single column with real text, so applicant tracking systems read it in order. It is the
// default for an uploaded resume, because it matches how most uploaded resumes are laid out.
export const executiveTokens: ResumeTemplateStyleTokens = {
  id: 'executive',
  name: 'Executive',
  description: 'Centered name, ruled sections, employer and location on one line, title and dates on the next. Dense but easy to scan.',
  defaultAccentColor: '111111',

  docxFontFamily: 'Times New Roman',
  pdfFontFamily: 'Times-Roman',

  nameSizePt: 18,
  targetTitleSizePt: 11,
  headingSizePt: 11.5,
  bodySizePt: 10,
  contactSizePt: 9.5,

  headingCase: 'uppercase',
  headingBold: true,
  headingUsesAccent: false,

  marginInches: 0.7,

  layout: 'stacked',
  headerAlign: 'center',
  headingRule: true,

  spaceAfterHeadingPt: 4,
  spaceAfterParagraphPt: 6,
}
