'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import type { EmployerBrandView } from '@/lib/employer/brand-shared'

export type BrandFormState = { ok?: boolean; message?: string; error?: string } | undefined

const PICTURES = [
  { key: 'office', field: 'officeImageUrl', label: 'Office building', help: 'The wide picture behind your Home. A photo of your building or workplace works best.' },
  { key: 'logo', field: 'logoUrl', label: 'Logo', help: 'PNG or SVG with a plain background.' },
  { key: 'product', field: 'productImageUrl', label: 'Product', help: 'A picture of what you make or sell, shown in the corner of the picture.' },
] as const

// The employer's own look for its Home splash: three pictures, a product name and a tagline. Saving keeps everything typed
// if a picture fails to upload.
export function EmployerBrandForm({ action, brand, companyName, logoElsewhere = false }: { action: (prev: BrandFormState, fd: FormData) => Promise<BrandFormState>; brand: EmployerBrandView | null; companyName: string; /** The page already has a logo upload (the outplacement Program page), so this form leaves it out. */ logoElsewhere?: boolean }) {
  const [state, formAction] = useActionState(action, undefined)
  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-base font-semibold">Your Home picture</h2>
        <p className="text-sm text-muted-foreground">How {companyName} looks at the top of your Home. Everyone on your team sees it.</p>
      </div>
      <div className={logoElsewhere ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4 sm:grid-cols-3'}>
        {PICTURES.filter((p) => !(logoElsewhere && p.key === 'logo')).map((p) => {
          const current = brand?.[p.field] ?? null
          return (
            <div key={p.key} className="space-y-1.5">
              <Label htmlFor={`brand-${p.key}`}>{p.label}</Label>
              {current && (
                // eslint-disable-next-line @next/next/no-img-element -- the employer's own uploaded picture
                <img src={current} alt={`Current ${p.label.toLowerCase()} picture`} className="h-20 w-full rounded border border-border bg-white object-contain" />
              )}
              <Input id={`brand-${p.key}`} name={p.key} type="file" accept="image/*" />
              <p className="text-xs text-muted-foreground">{p.help}</p>
              {current && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name={`remove-${p.key}`} />
                  Remove this picture
                </label>
              )}
            </div>
          )
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="brand-product-name">Product name (optional)</Label>
          <Input id="brand-product-name" name="productName" maxLength={80} defaultValue={brand?.productName ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand-tagline">Tagline (optional)</Label>
          <Input id="brand-tagline" name="tagline" maxLength={120} defaultValue={brand?.tagline ?? ''} placeholder="One line about what you do" />
        </div>
      </div>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-muted-foreground">{state.message}</p>}
      <SubmitButton pendingLabel="Saving…">Save Home picture</SubmitButton>
    </form>
  )
}
