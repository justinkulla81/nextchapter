// Shared type + resolution helper for per-template style tokens (Master
// Build Script §13.2). Each template file in ./templates defines one of
// these; the docx builder and the PDF component both read from it so the
// two renderers stay visually in sync without sharing any rendering code.
//
// Every token here is typographic/spacing only — there is deliberately no
// "layout" token (no column count, no table option) because §13.2's whole
// point is that layout choices are what break parsers, so this system
// doesn't expose any.
export interface ResumeTemplateStyleTokens {
  id: string
  name: string
  description: string
  defaultAccentColor: string // hex, used unless the candidate picks a different one or 'none'

  // docx font names reference whatever's installed on the reader's
  // machine (docx never embeds fonts); PDF fonts are restricted to the 14
  // standard PDF fonts (Helvetica/Times-Roman/Courier families) so nothing
  // needs to be embedded or fetched at render time — no network dependency,
  // no font-license question, and no risk of a missing-glyph fallback.
  docxFontFamily: string
  pdfFontFamily: 'Helvetica' | 'Times-Roman' | 'Courier'

  nameSizePt: number
  targetTitleSizePt: number
  headingSizePt: number
  bodySizePt: number
  contactSizePt: number

  headingCase: 'uppercase' | 'none'
  headingBold: boolean
  // Whether section headings use the accent color (when one is active) —
  // some templates keep headings black/ink and reserve the accent for the
  // name only.
  headingUsesAccent: boolean

  marginInches: number

  // Space before a heading is exactly 2.5x space after, per spec. Stored
  // as the "after" value; "before" is derived (never hand-entered) so the
  // ratio can't drift between templates.
  spaceAfterHeadingPt: number
  spaceAfterParagraphPt: number
}

export function spaceBeforeHeadingPt(tokens: ResumeTemplateStyleTokens): number {
  return tokens.spaceAfterHeadingPt * 2.5
}

export type AccentColorChoice = string | null | undefined // undefined = template default, null = 'none' (monochrome)

export function resolveAccentColor(
  tokens: ResumeTemplateStyleTokens,
  choice: AccentColorChoice
): string | null {
  if (choice === undefined) return tokens.defaultAccentColor
  return choice // null stays null (no accent)
}

// A small, safe palette of accent colors a candidate can choose from
// instead — offering a free-form color picker would be exactly the kind
// of "control that can break parsing" the spec forbids building (it
// wouldn't break parsing itself, but it's the first step toward a
// free-form style editor, which the spec explicitly rules out for v1).
// Kept to 3 colors so "color + None" is 4 options total — within the
// design principle's "2-4 options -> adjacent buttons" rule, rather than
// tipping into dropdown territory.
export const ACCENT_COLOR_OPTIONS: { id: string; label: string; hex: string }[] = [
  { id: 'navy', label: 'Navy', hex: '1B3A5C' },
  { id: 'teal', label: 'Teal', hex: '0F766E' },
  { id: 'burgundy', label: 'Burgundy', hex: '7A2E3C' },
]
