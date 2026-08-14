import { Document, Paragraph, TextRun, convertInchesToTwip } from 'docx'
import type { ResumeDocumentData } from '../document-data'
import type { AccentColorChoice, ResumeTemplateStyleTokens } from '../style-tokens'
import { resolveAccentColor } from '../style-tokens'
import {
  PAGE_SIZE_LETTER,
  bodyParagraph,
  bulletNumberingConfig,
  bulletParagraph,
  docxAccentHex,
  headingParagraph,
  labelWithRightDateParagraph,
  pt,
} from './docx-shared'

// Content assembly shared by all three templates — every template's
// visual identity comes entirely from its ResumeTemplateStyleTokens, not
// from a different content structure, so this one function is the single
// place that decides what sections exist and in what order (kept in sync
// automatically across all three renderers instead of hand-duplicated).
export function buildResumeDocx(
  data: ResumeDocumentData,
  tokens: ResumeTemplateStyleTokens,
  accentColorChoice: AccentColorChoice = undefined
): Document {
  const accentColor = resolveAccentColor(tokens, accentColorChoice)
  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      spacing: { after: pt(2) },
      children: [
        new TextRun({
          text: data.name,
          bold: true,
          size: pt(tokens.nameSizePt),
          font: tokens.docxFontFamily,
          color: docxAccentHex(accentColor),
        }),
      ],
    })
  )

  if (data.targetTitle) {
    children.push(
      new Paragraph({
        spacing: { after: pt(4) },
        children: [
          new TextRun({
            text: data.targetTitle,
            size: pt(tokens.targetTitleSizePt),
            font: tokens.docxFontFamily,
          }),
        ],
      })
    )
  }

  const contactParts = [data.contact.location, data.contact.phone, data.contact.email, data.contact.linkedinUrl].filter(
    (part): part is string => Boolean(part)
  )
  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        spacing: { after: pt(tokens.spaceAfterHeadingPt) },
        children: [
          new TextRun({
            text: contactParts.join('   |   '),
            size: pt(tokens.contactSizePt),
            font: tokens.docxFontFamily,
          }),
        ],
      })
    )
  }

  if (data.summary) {
    children.push(headingParagraph('Summary', tokens, accentColor))
    children.push(bodyParagraph(data.summary, tokens))
  }

  if (data.workHistory.length > 0) {
    children.push(headingParagraph('Experience', tokens, accentColor))
    data.workHistory.forEach((role, index) => {
      children.push(
        labelWithRightDateParagraph({
          leftRuns: [
            new TextRun({ text: role.roleTitle, bold: true, size: pt(tokens.bodySizePt), font: tokens.docxFontFamily }),
            new TextRun({ text: `  —  ${role.companyName}`, size: pt(tokens.bodySizePt), font: tokens.docxFontFamily }),
          ],
          dateLabel: role.dateRangeLabel,
          tokens,
          spacingBeforePt: index === 0 ? 0 : tokens.spaceAfterParagraphPt,
        })
      )
      role.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, tokens)))
    })
  }

  if (data.education.length > 0) {
    children.push(headingParagraph('Education', tokens, accentColor))
    data.education.forEach((entry, index) => {
      const leftRuns = [
        new TextRun({ text: entry.schoolName, bold: true, size: pt(tokens.bodySizePt), font: tokens.docxFontFamily }),
      ]
      if (entry.degreeLabel) {
        leftRuns.push(
          new TextRun({ text: `  —  ${entry.degreeLabel}`, size: pt(tokens.bodySizePt), font: tokens.docxFontFamily })
        )
      }
      children.push(
        labelWithRightDateParagraph({
          leftRuns,
          dateLabel: entry.dateLabel ?? '',
          tokens,
          spacingBeforePt: index === 0 ? 0 : tokens.spaceAfterParagraphPt,
        })
      )
    })
  }

  if (data.skills.length > 0) {
    children.push(headingParagraph('Skills', tokens, accentColor))
    // Comma-separated rather than bullet-separated — a long skills list
    // wraps across multiple lines, and a bullet glyph sitting right at a
    // wrap point can visually collide with the next word (observed in the
    // PDF renderer); commas are the conventional, unambiguously-safe
    // separator for an inline list like this.
    children.push(bodyParagraph(data.skills.join(', '), tokens))
  }

  if (data.certifications.length > 0) {
    children.push(headingParagraph('Certifications', tokens, accentColor))
    children.push(bodyParagraph(data.certifications.join(', '), tokens))
  }

  const marginTwip = convertInchesToTwip(tokens.marginInches)

  return new Document({
    numbering: bulletNumberingConfig(tokens),
    sections: [
      {
        properties: {
          page: {
            size: PAGE_SIZE_LETTER,
            margin: { top: marginTwip, right: marginTwip, bottom: marginTwip, left: marginTwip },
          },
        },
        children,
      },
    ],
  })
}
