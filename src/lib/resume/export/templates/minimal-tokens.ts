import type { ResumeTemplateStyleTokens } from '../style-tokens'

// See classic-tokens.ts's header comment for why this data lives apart
// from minimal.ts's docx/PDF build functions.
//
// Minimal — the most restrained of the three: smallest type scale,
// tightest spacing, monochrome by default (accent is opt-in rather than
// on by default, since defaultAccentColor is still set but a candidate
// picking "none" here is the most natural fit of the three templates).
// Whitespace and hierarchy carry the whole design — exactly the §13.2
// thesis taken furthest.
export const minimalTokens: ResumeTemplateStyleTokens = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Compact, monochrome-friendly resume that leans entirely on type hierarchy and whitespace.',
  defaultAccentColor: '374151', // charcoal — deliberately understated even as a default

  docxFontFamily: 'Arial',
  pdfFontFamily: 'Helvetica',

  nameSizePt: 18,
  targetTitleSizePt: 11,
  headingSizePt: 9.5,
  bodySizePt: 9.5,
  contactSizePt: 9,

  headingCase: 'uppercase',
  headingBold: true,
  headingUsesAccent: false, // stays monochrome even when an accent color is chosen, except the name

  marginInches: 1,

  spaceAfterHeadingPt: 5.6, // before = 14pt (2.5x)
  spaceAfterParagraphPt: 4,
}
