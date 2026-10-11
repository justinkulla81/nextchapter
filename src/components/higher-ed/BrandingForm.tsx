'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'

type State = { error?: string; ok?: boolean; message?: string } | undefined

export function BrandingForm({
  saveAction,
  defaults,
}: {
  saveAction: (prev: State, formData: FormData) => Promise<State>
  defaults: { programBrandName: string | null; accentColor: string | null; tagline: string | null; logoUrl: string | null; heroImageUrl: string | null }
}) {
  const [state, action] = useActionState(saveAction, undefined)
  const [color, setColor] = useState(defaults.accentColor ?? '#2E7D5B')
  const [name, setName] = useState(defaults.programBrandName ?? '')
  const [tagline, setTagline] = useState(defaults.tagline ?? '')
  return (
    <form action={action} className="grid max-w-2xl gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="brand-name">Program name</Label>
        <Input id="brand-name" name="programBrandName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. W&J NextChapter" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="brand-tagline">Tagline (optional)</Label>
        <Input id="brand-tagline" name="tagline" maxLength={160} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. W&J has your back" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="brand-color">Accent color</Label>
        <div className="flex items-center gap-2">
          <input aria-label="Pick accent color" type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-9 w-12 rounded border border-input" />
          <Input id="brand-color" name="accentColor" value={color} onChange={(e) => setColor(e.target.value)} className="w-32 font-mono" />
        </div>
        <p className="text-xs text-muted-foreground">Used for buttons and the active workspace. Text on it is picked for contrast.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="brand-logo">Logo</Label>
        <Input id="brand-logo" name="logo" type="file" accept="image/*" />
        <p className="text-xs text-muted-foreground">{defaults.logoUrl ? 'Upload to replace the current logo.' : 'PNG or SVG, under 3MB.'}</p>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="brand-hero">Hero photo</Label>
        <Input id="brand-hero" name="hero" type="file" accept="image/*" />
        <p className="text-xs text-muted-foreground">Shown at the top of every member&apos;s home. A wide campus photo works best.</p>
      </div>
      <div className="space-y-2 sm:col-span-2">
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="text-sm text-muted-foreground">
            {state.message}
          </p>
        )}
        <SubmitButton pendingLabel="Saving…">Save branding</SubmitButton>
      </div>
    </form>
  )
}
