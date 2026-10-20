'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ColorField } from '@/components/partners/ColorField'
import { BrandPreview } from '@/components/partners/BrandPreview'
import { BRAND_SWATCHES } from '@/lib/partners/swatches'
import type { IntegrationKey } from '@/lib/organizations/portals'
import { deleteDemoOrganizationAction, demoAccessLinkAction, extendDemoAction, resetDemoAction, toggleIntegrationAction, updateBrandAction } from '@/app/support/admin/(portal)/organizations/actions'

const input = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'

export function OrganizationBrandForm({ organizationId, brandName, accent, secondary, background, logoUrl }: { organizationId: string; brandName: string | null; accent: string | null; secondary: string | null; background: string | null; logoUrl: string | null }) {
  const [state, action, pending] = useActionState(updateBrandAction.bind(null, organizationId), null)
  const [name, setName] = useState(brandName ?? '')
  const [primary, setPrimary] = useState(accent ?? '')
  const [second, setSecond] = useState(secondary ?? '')
  const [bg, setBg] = useState(background ?? '')
  return (
    <form action={action} className={`space-y-6 ${pending ? 'cursor-wait' : ''}`}>
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium" htmlFor="b-name">
          Brand name
          <input id="b-name" name="brandName" value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="off" />
        </label>
        <div />
        <ColorField label="Primary color" hint="Buttons, links and focus. Pick any color or type an exact hex code." name="accent" value={primary} onChange={setPrimary} swatches={BRAND_SWATCHES} />
        <ColorField label="Secondary color" hint="Secondary buttons, chips and highlights." name="secondary" value={second} onChange={setSecond} fallback="#c8963e" />
        <ColorField label="Background color" hint="The page behind everything. Text and cards adjust so they stay readable." name="background" value={bg} onChange={setBg} fallback="#f7f9fa" />
        <BrandPreview name={name} primary={primary} secondary={second} background={bg} logoUrl={logoUrl} />
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

export interface DemoTargetView {
  key: string
  label: string
  needsLink: boolean
}

// Everything an admin does with a demo: open it as each role, reset it, keep it longer.
export function DemoControls({ organizationId, targets, expires }: { organizationId: string; targets: DemoTargetView[]; expires: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [link, setLink] = useState<{ key: string; url: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  function open(key: string) {
    setError(null)
    setMessage(null)
    setBusy(key)
    start(async () => {
      const r = await demoAccessLinkAction(organizationId, key)
      setBusy(null)
      if (r.error || !r.url) return setError(r.error ?? 'Could not make a link.')
      setLink({ key, url: r.url })
    })
  }
  function copy(url: string) {
    navigator.clipboard
      .writeText(url)
      .then(() => setMessage('Link copied. It works once and expires within the hour.'))
      .catch(() => setMessage('Select the link and copy it.'))
  }

  return (
    <div className={`space-y-4 ${pending ? 'cursor-wait' : ''}`}>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Open the demo as</h3>
        <ul className="space-y-2">
          {targets.map((t) => (
            <li key={t.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
              <span>{t.label}</span>
              <button type="button" onClick={() => open(t.key)} disabled={pending} className="rounded-full border border-border px-4 py-1.5 font-semibold disabled:cursor-wait disabled:opacity-60">
                {busy === t.key ? 'Making link…' : t.needsLink ? 'Get sign-in link' : 'Open'}
              </button>
            </li>
          ))}
        </ul>
        {link && (
          <div role="status" className="space-y-2 rounded-md border border-dashed border-border bg-muted/40 p-3 text-sm">
            <p className="break-all">
              <a href={link.url} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">{link.url.slice(0, 90)}{link.url.length > 90 ? '…' : ''}</a>
            </p>
            <button type="button" onClick={() => copy(link.url)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">Copy link</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!confirmReset ? (
          <button type="button" onClick={() => setConfirmReset(true)} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">
            Reset demo data
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm" role="alertdialog" aria-label="Confirm reset">
            Rebuild all sample data from scratch?
            <button type="button" onClick={() => setConfirmReset(false)} className="rounded-full border border-border px-3 py-1.5 font-semibold">Keep it</button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null)
                  const r = await resetDemoAction(organizationId)
                  setConfirmReset(false)
                  if (r.error) return setError(r.error)
                  setMessage('Demo rebuilt.')
                  router.refresh()
                })
              }
              className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground disabled:cursor-wait"
            >
              {pending ? 'Rebuilding…' : 'Yes, reset'}
            </button>
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await extendDemoAction(organizationId)
              if (r.error) return setError(r.error)
              setMessage('Extended by 30 days.')
              router.refresh()
            })
          }
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:cursor-wait"
        >
          Keep for 30 more days
        </button>
        {expires && <span className="text-xs text-muted-foreground">Expires {expires}</span>}
      </div>
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
