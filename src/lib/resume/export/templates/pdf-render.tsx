import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { ResumeDocumentData, ResumeWorkHistoryItem } from '../document-data'
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
  const stacked = tokens.layout === 'stacked'
  const align = tokens.headerAlign === 'center' ? ('center' as const) : ('left' as const)
  const font = tokens.pdfFontFamily
  const body = { fontFamily: font, fontSize: tokens.bodySizePt }

  const contactParts = [data.contact.location, data.contact.phone, data.contact.email, data.contact.linkedinUrl].filter(
    (part): part is string => Boolean(part)
  )

  // One role. Inline: "Title — Company, Location" with the dates opposite. Stacked: the employer with its
  // location opposite, then the title with its dates opposite, then any further titles the same way.
  const roleHeader = (role: ResumeWorkHistoryItem) =>
    stacked ? (
      <View>
        <LabelWithRightDate tokens={tokens} dateLabel={role.location ?? ''} left={<Text style={{ ...body, fontWeight: 700 }}>{role.companyName}</Text>} />
        {(role.roleTitle || role.dateRangeLabel) && (
          <LabelWithRightDate tokens={tokens} dateLabel={role.dateRangeLabel} italicRight left={<Text style={{ ...body, fontStyle: 'italic' }}>{role.roleTitle}</Text>} />
        )}
        {(role.extraRoles ?? []).map((extra, i) => (
          <LabelWithRightDate key={i} tokens={tokens} dateLabel={extra.dateRangeLabel} italicRight left={<Text style={{ ...body, fontStyle: 'italic' }}>{extra.roleTitle}</Text>} />
        ))}
      </View>
    ) : (
      <View>
        <LabelWithRightDate
          tokens={tokens}
          dateLabel={role.dateRangeLabel}
          left={
            <Text style={body}>
              <Text style={{ fontFamily: font, fontWeight: 700 }}>{role.roleTitle}</Text>
              {`  —  ${role.companyName}${role.location ? `, ${role.location}` : ''}`}
            </Text>
          }
        />
        {(role.extraRoles ?? []).map((extra, i) => (
          <LabelWithRightDate key={i} tokens={tokens} dateLabel={extra.dateRangeLabel} left={<Text style={{ ...body, fontStyle: 'italic' }}>{extra.roleTitle}</Text>} />
        ))}
      </View>
    )

  return (
    <Document>
      <Page size={PDF_PAGE_SIZE} style={{ padding: marginPt, fontFamily: font }}>
        <Text style={{ fontFamily: font, fontWeight: 700, fontSize: tokens.nameSizePt, color: nameColor, marginBottom: 2, textAlign: align }}>{data.name}</Text>

        {data.targetTitle && (
          <Text style={{ fontFamily: font, fontSize: tokens.targetTitleSizePt, marginBottom: 4, textAlign: align }}>{data.targetTitle}</Text>
        )}

        {contactParts.length > 0 && (
          <Text style={{ fontFamily: font, fontSize: tokens.contactSizePt, marginBottom: tokens.spaceAfterHeadingPt, textAlign: align }}>
            {contactParts.join(stacked ? '  |  ' : '   |   ')}
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
                {roleHeader(role)}
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
              <View key={`${entry.schoolName}-${index}`} style={{ marginTop: index === 0 ? 0 : stacked ? 2 : tokens.spaceAfterParagraphPt }}>
                <LabelWithRightDate
                  tokens={tokens}
                  dateLabel={entry.dateLabel ?? ''}
                  italicRight={stacked}
                  left={
                    <Text style={body}>
                      <Text style={{ fontFamily: font, fontWeight: 700 }}>{entry.schoolName}</Text>
                      {entry.degreeLabel ? (stacked ? <Text style={{ fontStyle: 'italic' }}>{`, ${entry.degreeLabel}`}</Text> : `  —  ${entry.degreeLabel}`) : ''}
                    </Text>
                  }
                />
              </View>
            ))}
          </View>
        )}

        {(data.sections ?? []).map((section, si) => (
          <View key={`${section.heading}-${si}`}>
            <SectionHeading text={section.heading} tokens={tokens} accentColor={accentColor} />
            {section.items.map((item, ii) => (
              <View key={ii} style={{ marginTop: ii === 0 ? 0 : stacked ? 3 : tokens.spaceAfterParagraphPt }}>
                <LabelWithRightDate
                  tokens={tokens}
                  dateLabel={item.dateLabel ?? ''}
                  italicRight={stacked}
                  left={
                    <Text style={body}>
                      <Text style={{ fontFamily: font, fontWeight: 700 }}>{item.title}</Text>
                      {item.subtitle ? (stacked ? <Text style={{ fontStyle: 'italic' }}>{`, ${item.subtitle}`}</Text> : `  —  ${item.subtitle}`) : ''}
                    </Text>
                  }
                />
                {item.bullets.map((bullet, bi) => (
                  <BulletText key={bi} text={bullet} tokens={tokens} />
                ))}
              </View>
            ))}
          </View>
        ))}

        {data.skills.length > 0 && (
          <View>
            <SectionHeading text={data.skillsHeading || 'Skills'} tokens={tokens} accentColor={accentColor} />
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
