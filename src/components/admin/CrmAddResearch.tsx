'use client'

import { useActionState, useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { addResearchItem } from '@/app/support/admin/(portal)/crm/actions'

const EMPTY = { ok: false, message: '' }

export function CrmAddResearch() {
  const [result, action] = useActionState(addResearchItem, EMPTY)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand"
      >
        Add research
      </button>
    )
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Add research</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground underline">Close</button>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Title</span>
        <input name="title" required className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand" />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Link <span className="font-normal text-muted-foreground">or upload below</span></span>
          <input name="url" type="url" placeholder="https://…" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Year</span>
          <input name="publishedYear" inputMode="numeric" maxLength={4} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Or upload the PDF</span>
        <input
          name="file" type="file" accept="application/pdf"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Up to 25 MB. Worth doing for anything behind a paywall or a link that will rot.
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Publisher or institution</span>
          <input name="orgName" placeholder="Brookings Institution" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Authors <span className="font-normal text-muted-foreground">comma separated</span></span>
          <input name="authorNames" placeholder="Molly Kinder, Martha Ross" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
        </label>
      </div>

      <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
        Authors are matched to people you already have, and added as new ones where they are missing — a
        researcher is someone you may end up meeting, so the name on the paper and the record in the
        Ecosystem should be the same person.
      </p>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">The sentence you&apos;d quote, or have to answer</span>
        <textarea name="keyClaim" rows={2} className="w-full rounded-md border border-input bg-transparent p-2 text-sm" />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Where it sits</span>
          <select name="stance" defaultValue="UNSET" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
            <option value="UNSET">Not judged yet</option>
            <option value="SUPPORTS">Supports our thesis</option>
            <option value="CONTRADICTS">Cuts against it</option>
            <option value="MIXED">Mixed</option>
            <option value="NEUTRAL">Neutral</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Why it matters to us</span>
          <input name="relevanceNote" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
        </label>
      </div>

      <SubmitButton pendingLabel="Saving…">Save research</SubmitButton>
      {result.message && (
        <p role="status" className={`text-sm ${result.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
          {result.message}
        </p>
      )}
    </form>
  )
}
