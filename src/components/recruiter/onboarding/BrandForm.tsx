'use client'

import { useActionState, useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { BRAND_FONTS, BRAND_TONES, firmTheme, type BrandFont, type BrandTone } from '@/lib/recruiter/brand'
import { saveFirmBrand } from '@/app/recruiters/(app)/talent/onboarding/actions'
import { cn } from '@/lib/utils'

// Pick a color, font and background and watch the candidate page change.
// 2–4 options are adjacent buttons (design-principles.md).
export function BrandForm({
  firmName,
  logoUrl,
  heroUrl,
  initial,
}: {
  firmName: string
  logoUrl: string | null
  heroUrl: string | null
  initial: { accentColor: string | null; brandFont: string | null; brandTone: string | null }
}) {
  const start = firmTheme(initial)
  const [color, setColor] = useState(start.accent)
  const [font, setFont] = useState<BrandFont>(start.font)
  const [tone, setTone] = useState<BrandTone>(start.tone)
  const [state, action, pending] = useActionState(saveFirmBrand, undefined)
  const t = firmTheme({ accentColor: color, brandFont: font, brandTone: tone })

  const seg = <T extends string>(name: string, label: string, value: T, set: (v: T) => void, options: { value: T; label: string }[]) => (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="inline-flex flex-wrap overflow-hidden rounded-md border border-input">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => set(o.value)}
            className={cn(
              'border-r border-input px-3 py-2 text-sm last:border-r-0',
              value === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={value} />
    </fieldset>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <form action={action} className={cn('space-y-5', pending && 'cursor-progress')}>
        <div className="space-y-2">
          <Label htmlFor="accentColor">Brand color</Label>
          <div className="flex items-center gap-3">
            <input
              id="accentColor"
              name="accentColor"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent p-1"
            />
            <code className="text-sm text-muted-foreground">{color}</code>
          </div>
        </div>
        {seg('brandFont', 'Font', font, setFont, (Object.keys(BRAND_FONTS) as BrandFont[]).map((k) => ({ value: k, label: BRAND_FONTS[k].label })))}
        {seg('brandTone', 'Background', tone, setTone, (Object.keys(BRAND_TONES) as BrandTone[]).map((k) => ({ value: k, label: BRAND_TONES[k].label })))}
        {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {state?.success && <p className="text-sm text-success">{state.success}</p>}
        <SubmitButton pendingLabel="Saving…">Save my look</SubmitButton>
      </form>

      <div aria-label="Preview of your candidate page" className="overflow-hidden rounded-lg border border-border" style={{ background: t.bg, fontFamily: t.fontStack, color: t.ink }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ background: t.accent, color: t.onAccent }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-7 w-auto rounded-sm bg-white px-2 py-1" />
          ) : (
            <span className="text-lg" style={{ letterSpacing: '.04em' }}>{firmName}</span>
          )}
          <span className="text-xs uppercase tracking-widest opacity-90">Contact</span>
        </div>
        <div
          className="px-5 py-10"
          style={{
            background: heroUrl ? `linear-gradient(rgba(20,25,25,.45),rgba(20,25,25,.65)), url(${heroUrl}) center/cover` : t.accent,
            color: heroUrl ? '#fff' : t.onAccent,
          }}
        >
          <p className="text-2xl leading-tight" style={{ maxWidth: '16em' }}>Submit your resume to {firmName}</p>
          <p className="mt-2 text-sm opacity-90">Every submission gets an answer.</p>
        </div>
        <div className="space-y-3 px-5 py-5">
          <div className="rounded-md border px-4 py-3 text-sm" style={{ background: t.paper, borderColor: t.line }}>
            <p className="font-semibold">What to expect</p>
            <p style={{ color: t.muted }}>We review each resume against our current searches and answer every submission.</p>
          </div>
          <span className="inline-block px-5 py-2.5 text-xs uppercase tracking-widest" style={{ background: t.accent, color: t.onAccent }}>
            Send my resume
          </span>
        </div>
      </div>
    </div>
  )
}
