import { emailStyles } from '@/lib/email/email-styles'

interface Strength {
  title: string
  detail: string
}

interface HireabilityReportEmailProps {
  candidateName: string
  topStrengths: Strength[]
  topWeakness: Strength | null
  reportUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
  fontSize: '15px',
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '16px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function HireabilityReportEmail({
  candidateName,
  topStrengths,
  topWeakness,
  reportUrl,
}: HireabilityReportEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {candidateName},</p>
      <p>Your Hireability Report is ready. Here&apos;s a quick preview:</p>

      <p style={{ fontWeight: 600, marginTop: '24px' }}>Top strengths</p>
      {topStrengths.map((s) => (
        <p key={s.title}>
          <strong>{s.title}:</strong> {s.detail}
        </p>
      ))}

      {topWeakness && (
        <>
          <p style={{ fontWeight: 600, marginTop: '24px' }}>Where to focus</p>
          <p>
            <strong>{topWeakness.title}:</strong> {topWeakness.detail}
          </p>
        </>
      )}

      <p style={{ fontWeight: 600, marginTop: '24px' }}>How NextChapter works</p>
      <p>
        Your <strong>Market Reality Grade</strong> — what you just saw above — is an honest read on
        where you stand today. It only moves when you re-assess, not from weekly activity.
      </p>
      <p>
        Each week you&apos;ll commit to a <strong>Weekly Search Sprint</strong>: pick real actions
        worth points — 1 point = 1 minute of real effort — and hit that week&apos;s target to earn
        an A on your <strong>Weekly Search Score</strong>. You can set or change your commitment
        starting Sunday 12:01am PT, up until it locks Monday 12:01pm PT. Consistent effort there
        builds your <strong>Dossier</strong> — a reference-verified profile that shows hiring
        managers what your resume can&apos;t.
      </p>

      <p style={{ marginTop: '24px' }}>
        Your first week is orientation, not action — get familiar with your report, and Victoria
        will walk you through what&apos;s next.
      </p>

      <a href={reportUrl} style={button}>
        See your full report
      </a>

      <p style={footer}>This report is only visible to you — never shared with employers.</p>
    </div>
  )
}
