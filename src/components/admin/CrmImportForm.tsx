'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  previewImport, applyImport,
  type ImportPreview,
} from '@/app/support/admin/(portal)/crm/import/actions'

const EMPTY_PREVIEW: ImportPreview = { ok: false, message: '' }
const EMPTY_RESULT = { ok: false, message: '' }

// Upload is deliberately two steps. A CSV of people is exactly the input most
// likely to create silent duplicates, so nothing is written until you've seen
// what it would do — and name-only matches stop and ask per row rather than
// being resolved in either direction.
export function CrmImportForm() {
  const [preview, previewAction] = useActionState(previewImport, EMPTY_PREVIEW)
  const [result, applyAction] = useActionState(applyImport, EMPTY_RESULT)

  if (result.message) {
    return (
      <div className="rounded-lg border border-border p-6">
        <p className="font-medium">{result.ok ? 'Import finished' : 'Import failed'}</p>
        <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
        <div className="mt-4 flex gap-2">
          <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Back to people
          </Link>
          <Link href="/support/admin/crm/import" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Upload another file
          </Link>
        </div>
      </div>
    )
  }

  if (!preview.ok || !preview.plan) {
    return (
      <form action={previewAction} className="rounded-lg border border-border p-6">
        <label htmlFor="crm-csv" className="block text-sm font-medium">Choose a CSV file</label>
        <input
          id="crm-csv" name="file" type="file" accept=".csv,text/csv" required
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Recognised columns: Full Name (or First/Last Name), Company, Position, Email, LinkedIn URL.
          Anything else is ignored. A file exported from this CRM can be edited and uploaded straight back.
        </p>
        <div className="mt-4"><SubmitButton pendingLabel="Reading…">Preview import</SubmitButton></div>
        {preview.message && <p role="status" className="mt-3 text-sm text-destructive">{preview.message}</p>}
      </form>
    )
  }

  const { counts, plan } = preview
  const confirmRows = plan.filter((p) => p.action === 'confirm')

  return (
    <form action={applyAction} className="space-y-4">
      <input type="hidden" name="payload" value={preview.payload ?? ''} />

      <div className="rounded-lg border border-border p-4">
        <p className="font-medium">{preview.message}</p>
        <ul className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <li><strong className="text-foreground">{counts?.create ?? 0}</strong> new people</li>
          <li><strong className="text-foreground">{counts?.update ?? 0}</strong> matched existing records</li>
          <li><strong className="text-foreground">{counts?.confirm ?? 0}</strong> need your decision</li>
        </ul>
      </div>

      {confirmRows.length > 0 && (
        <div className="rounded-lg border border-orange/40 bg-orange/5 p-4">
          <h2 className="text-sm font-semibold">Same name, nothing else in common</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These rows match an existing record by name only. A shared name isn&apos;t evidence of a shared
            person, so pick what should happen. Anything left on &ldquo;Skip&rdquo; is not imported.
          </p>
          <ul className="mt-3 space-y-2">
            {confirmRows.map((p) => (
              <li key={p.index} className="rounded-md border border-border bg-background p-3 text-sm">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  In your file: {[p.title, p.company].filter(Boolean).join(' at ') || 'no company or title'}
                  {p.email ? ` · ${p.email}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">Already in the CRM: {p.matchedName}</p>
                {/* Three discrete options -> adjacent radios, per design-principles.md. */}
                <fieldset className="mt-2 flex flex-wrap gap-4">
                  <legend className="sr-only">What to do with {p.name}</legend>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" name={`decide-${p.index}`} value="skip" defaultChecked /> Skip
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" name={`decide-${p.index}`} value="merge" /> Merge into existing
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" name={`decide-${p.index}`} value="create" /> Add as a separate person
                  </label>
                </fieldset>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">See all {plan.length} rows</summary>
        <div className="mt-3 max-h-96 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-medium">Name</th>
                <th className="px-2 py-1.5 font-medium">Company</th>
                <th className="px-2 py-1.5 font-medium">What happens</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((p) => (
                <tr key={p.index} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5">{p.name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.company ?? '—'}</td>
                  <td className="px-2 py-1.5">
                    {p.action === 'create' && 'Add as new'}
                    {p.action === 'update' && `Update existing (matched on ${p.matchedOn})`}
                    {p.action === 'confirm' && <span className="text-orange">Needs your decision</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Importing…">Import {plan.length} rows</SubmitButton>
        <Link href="/support/admin/crm/import" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Cancel
        </Link>
      </div>
    </form>
  )
}
