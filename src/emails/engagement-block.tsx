import { emailStyles } from '@/lib/email/email-styles'
import type { EngagementLead } from '@/lib/journey/engagement'

const box: React.CSSProperties = { marginTop: '20px', padding: '16px', borderRadius: '8px', backgroundColor: '#eef3f9' }
const stepStyle: React.CSSProperties = { marginTop: '12px' }
const link: React.CSSProperties = { color: '#1d4e89', fontWeight: 600, textDecoration: 'none' }
const muted: React.CSSProperties = { margin: '2px 0 0', ...emailStyles.muted }

// The part of a weekly email that says what the member hasn't connected or done
// yet and what it unlocks, or what to try when a search has stalled. Shared by
// the Monday, Friday and Saturday emails so they say the same thing
// (src/lib/journey/engagement.ts). Renders nothing when there is nothing to say.
export default function EngagementBlock({ lead, appUrl }: { lead: EngagementLead | null; appUrl: string }) {
  if (!lead) return null
  const abs = (path: string) => `${appUrl}${path}`
  return (
    <div style={box}>
      <p style={{ margin: 0, fontWeight: 600 }}>{lead.gate ? lead.gate.headline : 'Get more from NextChapter'}</p>
      <p style={{ margin: '6px 0 0' }}>{lead.gate ? lead.gate.body : lead.line}</p>
      {lead.gate && lead.steps.length > 0 && <p style={{ margin: '6px 0 0' }}>{lead.line}</p>}
      {lead.gate && (
        <p style={stepStyle}>
          <a href={abs(lead.gate.href)} style={link}>
            {lead.gate.cta} →
          </a>
        </p>
      )}
      {lead.steps.map((step) => (
        <div key={step.key} style={stepStyle}>
          <a href={abs(step.href)} style={link}>
            {step.label} →
          </a>
          <p style={muted}>{step.why}</p>
          <p style={muted}>Unlocks: {step.unlocks}</p>
        </div>
      ))}
    </div>
  )
}
