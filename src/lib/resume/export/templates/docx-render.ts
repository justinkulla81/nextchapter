import { AlignmentType, Document, Paragraph, TextRun, convertInchesToTwip } from 'docx'
import type { ResumeDocumentData, ResumeWorkHistoryItem } from '../document-data'
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

// Content assembly shared by all templates — every template's
// visual identity comes entirely from its ResumeTemplateStyleTokens, not
// from a different content structure, so this one function is the single
// place that decides what sections exist and in what order (kept in sync
// automatically across all renderers instead of hand-duplicated).
export function buildResumeDocx(
  data: ResumeDocumentData,
  tokens: ResumeTemplateStyleTokens,
  accentColorChoice: AccentColorChoice = undefined
): Document {
  const accentColor = resolveAccentColor(tokens, accentColorChoice)
  const children: Paragraph[] = []
  const stacked = tokens.layout === 'stacked'
  const alignment = tokens.headerAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT
  const font = tokens.docxFontFamily
  const size = pt(tokens.bodySizePt)
  const run = (text: string, extra: { bold?: boolean; italics?: boolean } = {}) => new TextRun({ text, size, font, ...extra })

  children.push(
    new Paragraph({
      alignment,
      spacing: { after: pt(2) },
      children: [new TextRun({ text: data.name, bold: true, size: pt(tokens.nameSizePt), font, color: docxAccentHex(accentColor) })],
    })
  )

  if (data.targetTitle) {
    children.push(
      new Paragraph({
        alignment,
        spacing: { after: pt(4) },
        children: [new TextRun({ text: data.targetTitle, size: pt(tokens.targetTitleSizePt), font })],
      })
    )
  }

  const contactParts = [data.contact.location, data.contact.phone, data.contact.email, data.contact.linkedinUrl].filter(
    (part): part is string => Boolean(part)
  )
  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        alignment,
        spacing: { after: pt(tokens.spaceAfterHeadingPt) },
        children: [new TextRun({ text: contactParts.join(stacked ? '  |  ' : '   |   '), size: pt(tokens.contactSizePt), font })],
      })
    )
  }

  if (data.summary) {
    children.push(headingParagraph('Summary', tokens, accentColor))
    children.push(bodyParagraph(data.summary, tokens))
  }

  // One role. Inline: "Title — Company, Location" with the dates opposite. Stacked: the employer with its
  // location opposite, then the title with its dates opposite, then any further titles the same way.
  const roleHeader = (role: ResumeWorkHistoryItem, spacingBeforePt: number): Paragraph[] => {
    const extras = role.extraRoles ?? []
    if (stacked) {
      const out: Paragraph[] = [
        labelWithRightDateParagraph({ leftRuns: [run(role.companyName, { bold: true })], dateLabel: role.location ?? '', tokens, spacingBeforePt }),
      ]
      if (role.roleTitle || role.dateRangeLabel) {
        out.push(labelWithRightDateParagraph({ leftRuns: [run(role.roleTitle, { italics: true })], dateLabel: role.dateRangeLabel, tokens, italicRight: true }))
      }
      for (const extra of extras) {
        out.push(labelWithRightDateParagraph({ leftRuns: [run(extra.roleTitle, { italics: true })], dateLabel: extra.dateRangeLabel, tokens, italicRight: true }))
      }
      return out
    }
    const out: Paragraph[] = [
      labelWithRightDateParagraph({
        leftRuns: [run(role.roleTitle, { bold: true }), run(`  —  ${role.companyName}${role.location ? `, ${role.location}` : ''}`)],
        dateLabel: role.dateRangeLabel,
        tokens,
        spacingBeforePt,
      }),
    ]
    for (const extra of extras) {
      out.push(labelWithRightDateParagraph({ leftRuns: [run(extra.roleTitle, { italics: true })], dateLabel: extra.dateRangeLabel, tokens }))
    }
    return out
  }

  if (data.workHistory.length > 0) {
    children.push(headingParagraph('Experience', tokens, accentColor))
    data.workHistory.forEach((role, index) => {
      children.push(...roleHeader(role, index === 0 ? 0 : tokens.spaceAfterParagraphPt))
      role.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, tokens)))
    })
  }

  if (data.education.length > 0) {
    children.push(headingParagraph('Education', tokens, accentColor))
    data.education.forEach((entry, index) => {
      const leftRuns = [run(entry.schoolName, { bold: true })]
      if (entry.degreeLabel) leftRuns.push(stacked ? run(`, ${entry.degreeLabel}`, { italics: true }) : run(`  —  ${entry.degreeLabel}`))
      children.push(
        labelWithRightDateParagraph({
          leftRuns,
          dateLabel: entry.dateLabel ?? '',
          tokens,
          italicRight: stacked,
          spacingBeforePt: index === 0 ? 0 : stacked ? 2 : tokens.spaceAfterParagraphPt,
        })
      )
    })
  }

  for (const section of data.sections ?? []) {
    children.push(headingParagraph(section.heading, tokens, accentColor))
    section.items.forEach((item, index) => {
      const leftRuns = [run(item.title, { bold: true })]
      if (item.subtitle) leftRuns.push(stacked ? run(`, ${item.subtitle}`, { italics: true }) : run(`  —  ${item.subtitle}`))
      children.push(
        labelWithRightDateParagraph({
          leftRuns,
          dateLabel: item.dateLabel ?? '',
          tokens,
          italicRight: stacked,
          spacingBeforePt: index === 0 ? 0 : stacked ? 3 : tokens.spaceAfterParagraphPt,
        })
      )
      item.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, tokens)))
    })
  }

  if (data.skills.length > 0) {
    children.push(headingParagraph(data.skillsHeading || 'Skills', tokens, accentColor))
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
