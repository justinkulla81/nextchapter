'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { accentReadableOnWhite, normalizeHex } from '@/lib/partners/brand'
import type { IntegrationKey } from '@/lib/organizations/portals'
import { deleteDemoOrganizationAction, toggleIntegrationAction, updateBrandAction } from '@/app/support/admin/(portal)/organizations/actions'

const input = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'

export function OrganizationBrandForm({ organizationId, brandName, accent, logoUrl }: { organizationId: string; brandName: string | null; accent: string | null; logoUrl: string | null }) {
  const [state, action, pending] = useActionState(updateBrandAction.bind(null, organizationId), null)
  const [color, setColor] = useState(accent ?? '')
  const norm = color ? normalizeHex(color) : null
  return (
    <form action={action} className={`space-y-4 ${pending ? 'cursor-wait' : ''}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium" htmlFor="b-name">
          Brand name
          <input id="b-name" name="brandName" defaultValue={brandName ?? ''} className={input} autoComplete="off" />
        </label>
        <label className="space-y-1.5 text-sm font-medium" htmlFor="b-accent">
          Brand color
          <span className="flex items-center gap-2">
            <input id="b-accent" name="accent" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#1d6fb8" maxLength={7} className={input} autoComplete="off" aria-invalid={!!color && !norm} />
            {norm && <span aria-hidden="true" className="size-9 shrink-0 rounded-md border border-border" style={{ backgroundColor: norm }} />}
          </span>
          {norm && !accentReadableOnWhite(norm) && <span className="block text-xs font-normal text-muted-foreground">Very light against white; links and charts in it may be hard to read.</span>}
        </label>
        <label className="space-y-1.5 text-sm font-medium" htmlFor="b-logo">
          Upload a logo (png or jpg)
          <input id="b-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="block text-sm font-normal" />
        </label>
        <label className="space-y-1.5 text-sm font-medium" htmlFor="b-logo-url">
          Or a logo link (https)
          <input id="b-logo-url" name="logoUrl" defaultValue={logoUrl ?? ''} className={input} autoComplete="off" />
        </label>
      </div>
      {logoUrl && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="removeLogo" /> Remove the current logo
        </label>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-60">
          {pending ? 'Saving…' : 'Save brand'}
        </button>
        {state?.ok && <span role="status" className="text-sm text-success">Saved. Every portal this organization owns now uses it.</span>}
        {state?.error && <span role="alert" className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  )
}

export function IntegrationToggles({ organizationId, items }: { organizationId: string; items: Array<{ key: IntegrationKey; label: string; does: string; applies: boolean; on: boolean }> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <label key={i.key} className={`flex items-start gap-3 rounded-md border border-border p-3 text-sm ${i.applies ? 'cursor-pointer' : 'opacity-60'}`}>
          <input
            type="checkbox"
            className="mt-1"
            checked={i.on}
            disabled={!i.applies || pending}
            onChange={(e) =>
              start(async () => {
                setError(null)
                const r = await toggleIntegrationAction(organizationId, i.key, e.target.checked)
                if (r.error) setError(r.error)
                router.refresh()
              })
            }
          />
          <span>
            <span className="font-medium">{i.label}</span>
            <span className="block text-muted-foreground">{i.applies ? i.does : `Needs both portals. ${i.does}`}</span>
          </span>
        </label>
      ))}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// Deleting a demo removes everything it created, so it asks first and never takes focus by default.
export function DeleteDemoButton({ organizationId, name }: { organizationId: string; name: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-destructive underline underline-offset-4">
        Delete this demo
      </button>
    )
  }
  return (
    <div className="space-y-2 text-sm" role="alertdialog" aria-label="Confirm delete">
      <p>Delete {name} and all of its sample data? This cannot be undone.</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-border px-4 py-2 font-semibold">
          Keep it
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deleteDemoOrganizationAction(organizationId)
              if (r.error) return setError(r.error)
              router.push('/support/admin/organizations')
            })
          }
          className="rounded-full bg-destructive px-4 py-2 font-semibold text-white disabled:cursor-wait"
        >
          {pending ? 'Deleting…' : 'Yes, delete the demo'}
        </button>
      </div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  )
}
