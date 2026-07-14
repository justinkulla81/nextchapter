'use client'

import { useActionState } from 'react'
import { addContact } from '@/app/dashboard/network/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'FORMER_COLLEAGUE', label: 'Former colleague who respected your work' },
  { value: 'HIRING_CONNECTION', label: 'Hires at your level, or knows people who do' },
  { value: 'OWES_A_FAVOR', label: 'Owes you a favor / would take a call' },
  { value: 'RECENT_TRANSITION', label: "Made a successful transition recently" },
  { value: 'COULD_HELP_IN_RETURN', label: 'You could genuinely help in return' },
]

const WARMTH_OPTIONS = ['HOT', 'WARM', 'COLD']

export function AddContactForm() {
  const [state, formAction, pending] = useActionState(addContact, undefined)

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required disabled={pending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company">Company</Label>
        <Input id="company" name="company" disabled={pending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" disabled={pending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" disabled={pending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Choose a category
          </option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="warmth">Warmth</Label>
        <select
          id="warmth"
          name="warmth"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue="WARM"
        >
          {WARMTH_OPTIONS.map((w) => (
            <option key={w} value={w}>
              {w[0]}
              {w.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      {state?.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add contact'}
        </Button>
      </div>
    </form>
  )
}
