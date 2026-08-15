import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import type { SubmissionPacketData } from './submission-packet'

// Renders SubmissionPacketData (already an allowlist — see that file's
// header comment) to a one-document PDF, following the same house pattern
// as the resume exporter (src/lib/resume/export/templates/pdf-render.tsx):
// @react-pdf/renderer, plain Views/Text, no per-template token system here
// since there's only ever one submission-packet layout (branding is a logo
// + firm name, not a template choice).
const PAGE_STYLE = { padding: 40, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.4 }
const HEADING_STYLE = { fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 14, marginBottom: 4, textTransform: 'uppercase' as const, color: '#555555' }
const BODY_STYLE = { fontSize: 10, marginBottom: 4 }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={HEADING_STYLE}>{title}</Text>
      {children}
    </View>
  )
}

export function SubmissionPacketPdfDocument(data: SubmissionPacketData) {
  return (
    <Document>
      <Page size="LETTER" style={PAGE_STYLE}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18 }}>{data.candidateName}</Text>
            {data.candidateTargetTitle && <Text style={{ fontSize: 11, marginTop: 2 }}>{data.candidateTargetTitle}</Text>}
            {data.candidateLocation && <Text style={{ fontSize: 9, color: '#666666', marginTop: 2 }}>{data.candidateLocation}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {/* @react-pdf/renderer's Image is a PDF-drawing primitive, not an HTML <img> — it has no `alt` prop to set. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {data.firmLogoUrl && <Image src={data.firmLogoUrl} style={{ width: 90, maxHeight: 40, objectFit: 'contain' }} />}
            {data.firmName && <Text style={{ fontSize: 9, marginTop: 4 }}>{data.firmName}</Text>}
            <Text style={{ fontSize: 8, color: '#888888', marginTop: 2 }}>
              Submitted by {data.recruiterName} · {data.recruiterEmail}
            </Text>
          </View>
        </View>

        {data.positioningStatement && (
          <Section title="Positioning">
            <Text style={BODY_STYLE}>{data.positioningStatement}</Text>
          </Section>
        )}

        {data.categoryStrengths.length > 0 && (
          <Section title="Strengths">
            {data.categoryStrengths.map((s, i) => (
              <Text key={i} style={BODY_STYLE}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{s.label}: </Text>
                {s.text}
              </Text>
            ))}
          </Section>
        )}

        {(data.howIOperateSummaries.length > 0 || data.superpowers.length > 0) && (
          <Section title="How they operate">
            {data.howIOperateSummaries.map((s, i) => (
              <Text key={i} style={BODY_STYLE}>
                • {s}
              </Text>
            ))}
            {data.superpowers.map((s, i) => (
              <Text key={`sp-${i}`} style={BODY_STYLE}>
                • {s.label}
                {s.referenceConfirmed ? ' (independently confirmed by references)' : ''}
              </Text>
            ))}
          </Section>
        )}

        {data.impactQuotes.length > 0 && (
          <Section title="What references say">
            {data.impactQuotes.map((q, i) => (
              <Text key={i} style={{ ...BODY_STYLE, fontStyle: 'italic' }}>
                &ldquo;{q.quoteText}&rdquo; — {q.refereeName}
              </Text>
            ))}
          </Section>
        )}

        {data.referenceCount > 0 && (
          <Section title="Reference availability">
            <Text style={BODY_STYLE}>
              {data.hiringManagerCallAvailableCount} of {data.referenceCount} references have already confirmed
              they&apos;ll take a short call from the hiring manager if this candidate reaches final stages.
            </Text>
          </Section>
        )}

        {data.selfAwareness && (
          <Section title="Self-awareness">
            <Text style={BODY_STYLE}>{data.selfAwareness}</Text>
          </Section>
        )}

        {data.learningGrowthItems.length > 0 && (
          <Section title="Learning & growth">
            {data.learningGrowthItems.map((item, i) => (
              <Text key={i} style={BODY_STYLE}>
                • {item}
              </Text>
            ))}
          </Section>
        )}

        {(data.fitSummary || data.targetPreferenceLines.length > 0) && (
          <Section title="Fit">
            {data.fitSummary && <Text style={BODY_STYLE}>{data.fitSummary}</Text>}
            {data.targetPreferenceLines.map((line, i) => (
              <Text key={i} style={BODY_STYLE}>
                • {line}
              </Text>
            ))}
          </Section>
        )}

        {data.proofPoints.length > 0 && (
          <Section title="Proof points">
            {data.proofPoints.map((pp, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={{ ...BODY_STYLE, fontFamily: 'Helvetica-Bold' }}>{pp.question}</Text>
                <Text style={BODY_STYLE}>{pp.response}</Text>
              </View>
            ))}
          </Section>
        )}

        <Text style={{ fontSize: 7, color: '#999999', marginTop: 20 }}>
          Generated {data.generatedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}{' '}
          via NextChapter for Recruiters.
        </Text>
      </Page>
    </Document>
  )
}
