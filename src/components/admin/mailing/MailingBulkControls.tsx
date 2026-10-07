'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import { SubmitButton } from '@/components/ui/submit-button'
import { bulkMailingAction } from '@/app/support/admin/(portal)/crm/mailing/actions'

/**
 * Mailing actions in the people list's bulk bar: add the ticked people to
 * lists, or mark them as having received a report by hand. Lives inside
 * CrmBulkBar's form, so the row checkboxes come along as `selected`.
 */
export function MailingBulkControls({ lists, reportKeys }: { lists: { id: string; name: string }[]; reportKeys: string[] }) {
  const [result, setResult] = useState<string | null>(null)
  const run = async (fd: FormData) => {
    const r = await bulkMailingAction(fd)
    posthog.capture('crm_bulk_mailing_action', { op: fd.get('mailingOp'), people: fd.getAll('selected').length, ok: r.ok })
    setResult(r.message)
  }
  return (
    <div className="flex flex-wrap items-end gap-6 text-xs">
      <div>
        <span className="mb-1 block font-medium">Add to mailing lists</span>
        <span className="flex flex-wrap gap-2">
          {lists.map((l) => (
            <label key={l.id} className="flex items-center gap-1"><input type="checkbox" name="bulkListId" value={l.id} /> {l.name}</label>
          ))}
        </span>
        <span className="mt-1 block">
          <SubmitButton size="sm" variant="outline" name="mailingOp" value="add" formAction={run} pendingLabel="Adding…">Add to ticked lists</SubmitButton>
        </span>
      </div>
      <div>
        <span className="mb-1 block font-medium">Mark report as received</span>
        <span className="flex flex-wrap items-center gap-2">
          <input name="bulkEditionKey" list="bulk-report-keys" defaultValue={reportKeys[0] ?? ''} placeholder="2026-09" aria-label="Report month" className="h-8 w-24 rounded border border-input bg-transparent px-2" />
          <datalist id="bulk-report-keys">{reportKeys.map((k) => <option key={k} value={k} />)}</datalist>
          {/* Four options, so adjacent buttons rather than a dropdown. */}
          <span role="radiogroup" aria-label="How it was sent" className="flex gap-1">
            {[['EMAIL', 'Email'], ['LINKEDIN', 'LinkedIn'], ['IN_PERSON', 'In person'], ['OTHER', 'Other']].map(([v, l]) => (
              <label key={v} className="cursor-pointer rounded-md border border-border px-2 py-1 has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:checked]:font-semibold has-[:checked]:text-brand">
                <input type="radio" name="bulkChannel" value={v} defaultChecked={v === 'EMAIL'} className="sr-only" /> {l}
              </label>
            ))}
          </span>
          <SubmitButton size="sm" variant="outline" name="mailingOp" value="received" formAction={run} pendingLabel="Marking…">Mark received</SubmitButton>
        </span>
      </div>
      {result && <p role="status" className="basis-full text-muted-foreground">{result}</p>}
    </div>
  )
}
