import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { ResumeDocumentData } from '../document-data'
import type { AccentColorChoice, ResumeTemplateStyleTokens } from '../style-tokens'
import { resolveAccentColor } from '../style-tokens'
import { BodyText, BulletText, LabelWithRightDate, PDF_PAGE_SIZE, SectionHeading } from './pdf-shared'

// Mirrors buildResumeDocx's section structure exactly — same content, same
// order, same "skip empty sections" rule — so a candidate never sees the
// docx and PDF disagree about what's on the page. See that file's comment
// for why a single generic renderer (driven by tokens) is used instead of
// per-template duplication.
export function buildResumePdfDocument(
  data: ResumeDocumentData,
  tokens: ResumeTemplateStyleTokens,
  accentColorChoice: AccentColorChoice = undefined
) {
  const accentColor = resolveAccentColor(tokens, accentColorChoice)
  const marginPt = tokens.marginInches * 72
  const nameColor = accentColor ? `#${accentColor}` : '#111111'

  const contactParts = [data.contact.location, data.contact.phone, data.contact.email, data.contact.linkedinUrl].filter(
    (part): part is string => Boolean(part)
  )

  return (
    <Document>
      <Page size={PDF_PAGE_SIZE} style={{ padding: marginPt, fontFamily: tokens.pdfFontFamily }}>
        <Text style={{ fontFamily: tokens.pdfFontFamily, fontWeight: 700, fontSize: tokens.nameSizePt, color: nameColor, marginBottom: 2 }}>
          {data.name}
        </Text>

        {data.targetTitle && (
          <Text style={{ fontFamily: tokens.pdfFontFamily, fontSize: tokens.targetTitleSizePt, marginBottom: 4 }}>
            {data.targetTitle}
          </Text>
        )}

        {contactParts.length > 0 && (
          <Text style={{ fontFamily: tokens.pdfFontFamily, fontSize: tokens.contactSizePt, marginBottom: tokens.spaceAfterHeadingPt }}>
            {contactParts.join('   |   ')}
          </Text>
        )}

        {data.summary && (
          <View>
            <SectionHeading text="Summary" tokens={tokens} accentColor={accentColor} />
            <BodyText text={data.summary} tokens={tokens} />
          </View>
        )}

        {data.workHistory.length > 0 && (
          <View>
            <SectionHeading text="Experience" tokens={tokens} accentColor={accentColor} />
            {data.workHistory.map((role, index) => (
              <View key={`${role.companyName}-${role.roleTitle}-${index}`} style={{ marginTop: index === 0 ? 0 : tokens.spaceAfterParagraphPt }}>
                <LabelWithRightDate
                  tokens={tokens}
                  dateLabel={role.dateRangeLabel}
                  left={
                    <Text style={{ fontFamily: tokens.pdfFontFamily, fontSize: tokens.bodySizePt }}>
                      <Text style={{ fontFamily: tokens.pdfFontFamily, fontWeight: 700 }}>{role.roleTitle}</Text>
                      {`  —  ${role.companyName}`}
                    </Text>
                  }
                />
                {role.bullets.map((bullet, bulletIndex) => (
                  <BulletText key={bulletIndex} text={bullet} tokens={tokens} />
                ))}
              </View>
            ))}
          </View>
        )}

        {data.education.length > 0 && (
          <View>
            <SectionHeading text="Education" tokens={tokens} accentColor={accentColor} />
            {data.education.map((entry, index) => (
              <View key={`${entry.schoolName}-${index}`} style={{ marginTop: index === 0 ? 0 : tokens.spaceAfterParagraphPt }}>
                <LabelWithRightDate
                  tokens={tokens}
                  dateLabel={entry.dateLabel ?? ''}
                  left={
                    <Text style={{ fontFamily: tokens.pdfFontFamily, fontSize: tokens.bodySizePt }}>
                      <Text style={{ fontFamily: tokens.pdfFontFamily, fontWeight: 700 }}>{entry.schoolName}</Text>
                      {entry.degreeLabel ? `  —  ${entry.degreeLabel}` : ''}
                    </Text>
                  }
                />
              </View>
            ))}
          </View>
        )}

        {data.skills.length > 0 && (
          <View>
            <SectionHeading text="Skills" tokens={tokens} accentColor={accentColor} />
            {/* Comma-separated, not bullet-separated — see docx-render.ts's
                matching comment: a bullet glyph landing right at a
                line-wrap point can visually collide with the next word. */}
            <BodyText text={data.skills.join(', ')} tokens={tokens} />
          </View>
        )}

        {data.certifications.length > 0 && (
          <View>
            <SectionHeading text="Certifications" tokens={tokens} accentColor={accentColor} />
            <BodyText text={data.certifications.join(', ')} tokens={tokens} />
          </View>
        )}
      </Page>
    </Document>
  )
}
