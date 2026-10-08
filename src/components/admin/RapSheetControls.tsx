'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { decideRapSheet } from '@/app/support/admin/(portal)/crm/rap-sheets/actions'

/** Include / Skip as adjacent buttons; the current choice is the filled one. */
export function RapSheetDecision({ sheetId, personId, status }: { sheetId: string; personId: string; status: string }) {
  const [pending, start] = useTransition()
  const choose = (d: 'APPROVED' | 'SKIPPED') =>
    start(async () => {
      posthog.capture('rap_sheet_decision_made', { sheetId, personId, decision: d })
      await decideRapSheet(sheetId, d)
    })
  return (
    <div className={`flex gap-2 ${pending ? 'cursor-wait' : ''}`} role="group" aria-label="Rap sheet decision">
      <Button size="sm" variant={status === 'APPROVED' ? 'default' : 'outline'} disabled={pending} onClick={() => choose('APPROVED')}>
        {status === 'APPROVED' ? 'Included' : 'Include in morning email'}
      </Button>
      <Button size="sm" variant={status === 'SKIPPED' ? 'default' : 'outline'} disabled={pending} onClick={() => choose('SKIPPED')}>
        {status === 'SKIPPED' ? 'Skipped' : 'Skip'}
      </Button>
    </div>
  )
}

/** Builds the sheet now (about a minute or two) and emails it. */
export function RapSheetGenerateButton({ personId, sheetId, label }: { personId: string; sheetId?: string; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function run() {
    setBusy(true); setMsg(null)
    posthog.capture('rap_sheet_generate_clicked', { personId, sheetId: sheetId ?? null })
    try {
      const res = await fetch('/api/admin/crm/rap-sheets/generate', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId, sheetId }),
      })
      const j = (await res.json()) as { error?: string; emailed?: boolean }
      if (!res.ok) setMsg({ ok: false, text: j.error ?? 'Could not build the rap sheet. Try again.' })
      else { setMsg({ ok: true, text: j.emailed ? 'Built and emailed to you.' : 'Built, but the email did not send. It is saved here.' }); router.refresh() }
    } catch {
      setMsg({ ok: false, text: 'Lost the connection while building. Check the CRM in a minute, then try again.' })
    } finally { setBusy(false) }
  }
  return (
    <div className={`flex flex-wrap items-center gap-3 ${busy ? 'cursor-wait' : ''}`}>
      <Button size="sm" onClick={run} disabled={busy}>{busy ? 'Researching… about a minute' : label}</Button>
      {msg && <span role="status" className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
    </div>
  )
}
