import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EmbedCard, embedRow } from '@/components/embed/EmbedCard'
import { STATE_UI, UI_LAST_VERIFIED } from '@/lib/data/state-ui'
import { stateFromSlug, stateName } from '@/lib/seo/states'

export const revalidate = 86400
export const metadata: Metadata = { robots: { index: false, follow: true } }

// Embeddable widget: a state's unemployment benefits at a glance, from the official-source facts in state-ui.ts.
export default async function EmbedBenefits({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const code = stateFromSlug(state)
  const ui = code ? STATE_UI[code] : null
  if (!code || !ui) notFound()
  const rows: [string, string][] = []
  if (ui.maxWeeklyBenefit.value != null) rows.push(['Most per week', `$${ui.maxWeeklyBenefit.value.toLocaleString('en-US')}`])
  if (ui.maxWeeks.value != null) rows.push(['Most weeks', `${ui.maxWeeks.value}${ui.durationVaries.value ? ' (varies with the state unemployment rate)' : ''}`])
  if (ui.waitingWeek.value != null) rows.push(['Waiting week', ui.waitingWeek.value ? 'Yes' : 'No'])
  return (
    <EmbedCard title={`${stateName(code)} unemployment benefits`} href={`/unemployment-benefits/${state}`} linkLabel={`How to file in ${stateName(code)}`} note={`Checked against ${ui.agencyName.value ?? 'the state agency'} sources ${UI_LAST_VERIFIED}.`}>
      {rows.map(([k, v]) => (
        <div key={k} style={embedRow}><span>{k}</span><strong>{v}</strong></div>
      ))}
      {ui.fileUrl.value && (
        <p style={{ margin: '10px 0 0' }}>
          <a href={ui.fileUrl.value} target="_blank" rel="noopener" style={{ color: '#1f5fbf' }}>File a claim with {ui.agencyName.value ?? 'the state agency'}</a>
        </p>
      )}
    </EmbedCard>
  )
}
