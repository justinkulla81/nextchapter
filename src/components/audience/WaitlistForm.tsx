'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { AudienceTab } from './audience-data'

// Empty env var = demo mode (no network call, confirmation only). Set to a
// relative path (default, backed by the /api/waitlist route + Postgres) or
// swap to an external Formspree/Buttondown-style URL if preferred.
const WAITLIST_ENDPOINT = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT

export function WaitlistForm({ tab }: { tab: AudienceTab }) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    // Honeypot — bots fill every field including hidden ones. Real users
    // never see or fill this, so any value here means silently drop it.
    if ((formData.get('_gotcha') as string)?.trim()) {
      setSubmitted(true)
      return
    }

    const nextErrors: Record<string, string> = {}
    for (const field of tab.fields) {
      const value = (formData.get(field.name) as string | null)?.trim() ?? ''
      if (field.required && !value) {
        nextErrors[field.name] = 'Required.'
      }
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        nextErrors[field.name] = 'Enter a valid email.'
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    setSubmitting(true)

    const payload: Record<string, string> = { audience: tab.audience }
    for (const field of tab.fields) {
      payload[field.name] = (formData.get(field.name) as string | null)?.trim() ?? ''
    }

    try {
      if (WAITLIST_ENDPOINT) {
        await fetch(WAITLIST_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      // No endpoint configured — demo mode. Still show the confirmation so
      // the form is usable before the owner finishes wiring up storage.
      setSubmitted(true)
    } catch {
      // Never block the visitor on a network hiccup — still confirm.
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-foreground">
        {tab.successMessage}
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('relative space-y-4', submitting && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div>
        <h3 className="font-semibold text-foreground">{tab.formHeading}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{tab.formSubtext}</p>
      </div>

      {/* Honeypot — hidden from real users via CSS, not display:none (some bots skip those). */}
      <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
        <label htmlFor={`_gotcha-${tab.id}`}>Leave this field empty</label>
        <input
          id={`_gotcha-${tab.id}`}
          name="_gotcha"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {tab.fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={`${tab.id}-${field.name}`}>
            {field.label}
            {!field.required && <span className="text-muted-foreground"> (optional)</span>}
          </Label>

          {field.type === 'select' ? (
            <Select name={field.name}>
              <SelectTrigger id={`${tab.id}-${field.name}`} className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.type === 'textarea' ? (
            <Textarea id={`${tab.id}-${field.name}`} name={field.name} rows={3} />
          ) : (
            <Input
              id={`${tab.id}-${field.name}`}
              name={field.name}
              type={field.type}
              aria-invalid={!!errors[field.name]}
            />
          )}

          {errors[field.name] && <p className="text-sm text-destructive">{errors[field.name]}</p>}
        </div>
      ))}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Submitting…' : 'Join the waitlist'}
      </Button>
    </form>
  )
}
