import { Document, Page, Text, View } from '@react-pdf/renderer'
import { RFP_QUESTIONS, SCORECARD_CRITERIA } from './rfp-template-content'

// Same house pattern as the recruiter submission packet
// (src/lib/recruiter/submission-packet-pdf.tsx) and the resume exporter:
// @react-pdf/renderer, plain Views/Text, no per-template token system
// since there's only one layout for this document.
const PAGE_STYLE = { padding: 40, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.4 }
const HEADING_STYLE = {
  fontFamily: 'Helvetica-Bold',
  fontSize: 9,
  marginTop: 14,
  marginBottom: 4,
  textTransform: 'uppercase' as const,
  color: '#555555',
}
const QUESTION_STYLE = { fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 10, marginBottom: 2 }
const BODY_STYLE = { fontSize: 9.5, marginBottom: 4, color: '#333333' }

export function RfpTemplatePdfDocument() {
  return (
    <Document>
      <Page size="LETTER" style={PAGE_STYLE}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18 }}>Outplacement RFP Template</Text>
        <Text style={{ fontSize: 10, color: '#666666', marginTop: 4 }}>
          A vendor-neutral evaluation tool — run it against any provider you&apos;re considering, including
          NextChapter.
        </Text>

        <View>
          <Text style={HEADING_STYLE}>The eight questions</Text>
          {RFP_QUESTIONS.map((q, i) => (
            <View key={q.question} wrap={false}>
              <Text style={QUESTION_STYLE}>
                {i + 1}. {q.question}
              </Text>
              <Text style={BODY_STYLE}>{q.whyItMatters}</Text>
              <View
                style={{
                  marginTop: 4,
                  marginBottom: 6,
                  borderBottom: '1 solid #dddddd',
                  height: 24,
                }}
              />
            </View>
          ))}
        </View>

        <View break>
          <Text style={HEADING_STYLE}>Vendor evaluation scorecard</Text>
          <Text style={BODY_STYLE}>
            Score each vendor 1–5 on every criterion, then compare totals across your finalists.
          </Text>
          <View style={{ marginTop: 8, flexDirection: 'row', borderBottom: '1 solid #333333', paddingBottom: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, flex: 3 }}>Criterion</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, flex: 1, textAlign: 'center' }}>
              Vendor A
            </Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, flex: 1, textAlign: 'center' }}>
              Vendor B
            </Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, flex: 1, textAlign: 'center' }}>
              Vendor C
            </Text>
          </View>
          {SCORECARD_CRITERIA.map((c) => (
            <View
              key={c.label}
              style={{ flexDirection: 'row', borderBottom: '1 solid #eeeeee', paddingVertical: 5 }}
              wrap={false}
            >
              <View style={{ flex: 3 }}>
                <Text style={{ fontSize: 9.5 }}>{c.label}</Text>
                <Text style={{ fontSize: 8, color: '#888888' }}>{c.description}</Text>
              </View>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 9.5 }}>___</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 9.5 }}>___</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 9.5 }}>___</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5, flex: 3 }}>Total</Text>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 9.5 }}>___</Text>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 9.5 }}>___</Text>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 9.5 }}>___</Text>
          </View>
        </View>

        <Text style={{ marginTop: 16, fontSize: 8, color: '#999999' }}>
          Provided by NextChapter (launchyournextchapter.com) — free to use with any vendor.
        </Text>
      </Page>
    </Document>
  )
}
