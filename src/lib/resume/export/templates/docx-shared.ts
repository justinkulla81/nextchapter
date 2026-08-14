import {
  AlignmentType,
  convertInchesToTwip,
  LevelFormat,
  Paragraph,
  PositionalTab,
  PositionalTabAlignment,
  PositionalTabLeader,
  PositionalTabRelativeTo,
  TextRun,
  type INumberingOptions,
} from 'docx'
import type { ResumeTemplateStyleTokens } from '../style-tokens'
import { spaceBeforeHeadingPt } from '../style-tokens'

// US Letter in DXA (twentieths of a point). docx-js defaults to A4 — this
// must be set explicitly on every template's page config, per §13.2 and
// the docx skill's own gotcha list.
export const PAGE_SIZE_LETTER = { width: 12240, height: 15840 }

export function pt(value: number): number {
  return value * 20 // DXA
}

// Every bullet across all three templates shares one numbering
// definition. Never insert a literal "•" character into run text — that
// breaks re-flow/re-numbering in Word and is the docx skill's own
// documented gotcha; a real LevelFormat.BULLET config is required.
export const BULLET_NUMBERING_REFERENCE = 'resume-bullets'

export function bulletNumberingConfig(tokens: ResumeTemplateStyleTokens): INumberingOptions {
  return {
    config: [
      {
        reference: BULLET_NUMBERING_REFERENCE,
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '•',
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: convertInchesToTwip(0.22), hanging: convertInchesToTwip(0.16) } },
              run: { font: tokens.docxFontFamily, size: pt(tokens.bodySizePt) },
            },
          },
        ],
      },
    ],
  }
}

export function docxAccentHex(accentColor: string | null): string | undefined {
  return accentColor ?? undefined
}

// A section heading. Space before is always exactly 2.5x space after
// (derived, never hand-set) — §13.2. No letter-spacing is applied here at
// all (docx-js has no letter-spacing option wired up in these paragraphs),
// satisfying "no letter-spacing on headings" by construction, not by
// avoidance.
export function headingParagraph(
  text: string,
  tokens: ResumeTemplateStyleTokens,
  accentColor: string | null
): Paragraph {
  const label = tokens.headingCase === 'uppercase' ? text.toUpperCase() : text
  return new Paragraph({
    spacing: { before: pt(spaceBeforeHeadingPt(tokens)), after: pt(tokens.spaceAfterHeadingPt) },
    children: [
      new TextRun({
        text: label,
        bold: tokens.headingBold,
        size: pt(tokens.headingSizePt),
        font: tokens.docxFontFamily,
        color: tokens.headingUsesAccent ? docxAccentHex(accentColor) : undefined,
      }),
    ],
  })
}

// A left label / right-aligned date on one line, using a REAL right tab
// stop (PositionalTab), never spaces and never a table — §13.2's explicit
// requirement.
export function labelWithRightDateParagraph(options: {
  leftRuns: TextRun[]
  dateLabel: string
  tokens: ResumeTemplateStyleTokens
  spacingBeforePt?: number
  spacingAfterPt?: number
}): Paragraph {
  const { leftRuns, dateLabel, tokens, spacingBeforePt = 0, spacingAfterPt = 0 } = options
  return new Paragraph({
    spacing: { before: pt(spacingBeforePt), after: pt(spacingAfterPt) },
    children: [
      ...leftRuns,
      new TextRun({
        children: [
          // A real space character ahead of the tab — it has no visual
          // effect (PositionalTab computes its stop relative to the page
          // margin, independent of what precedes it), but without it
          // mammoth's text extraction drops the w:ptab element entirely
          // and glues the label directly onto the date (e.g.
          // "ServicesDec 2016" instead of "Services Dec 2016"). Observed
          // by running a real generated docx through the app's own
          // extractResumeText() path — see verify-resume-templates.ts.
          ' ',
          new PositionalTab({
            alignment: PositionalTabAlignment.RIGHT,
            relativeTo: PositionalTabRelativeTo.MARGIN,
            leader: PositionalTabLeader.NONE,
          }),
          dateLabel,
        ],
        font: tokens.docxFontFamily,
        size: pt(tokens.bodySizePt),
      }),
    ],
  })
}

export function bodyParagraph(
  text: string,
  tokens: ResumeTemplateStyleTokens,
  options?: { italics?: boolean; spacingAfterPt?: number }
): Paragraph {
  return new Paragraph({
    spacing: { after: pt(options?.spacingAfterPt ?? tokens.spaceAfterParagraphPt) },
    children: [
      new TextRun({
        text,
        italics: options?.italics,
        size: pt(tokens.bodySizePt),
        font: tokens.docxFontFamily,
      }),
    ],
  })
}

export function bulletParagraph(text: string, tokens: ResumeTemplateStyleTokens): Paragraph {
  return new Paragraph({
    numbering: { reference: BULLET_NUMBERING_REFERENCE, level: 0 },
    spacing: { after: pt(2) },
    children: [new TextRun({ text, size: pt(tokens.bodySizePt), font: tokens.docxFontFamily })],
  })
}
