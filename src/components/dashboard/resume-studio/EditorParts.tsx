'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

// Small building blocks shared by the resume editor's sections.

export function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  type?: string
}) {
  return (
    <div className="space-y-1">
      <Label>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} className="mt-1" />
      </Label>
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  maxLength,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  maxLength?: number
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <Label>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength} className="mt-1" />
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// Move up, move down and remove for one item in a list. Buttons rather than
// drag-and-drop so reordering works from the keyboard and on a phone.
export function ReorderControls({
  noun,
  index,
  count,
  onMove,
  onRemove,
}: {
  noun: string
  index: number
  count: number
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button type="button" size="xs" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${noun} ${index + 1} up`}>
        Up
      </Button>
      <Button type="button" size="xs" variant="ghost" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${noun} ${index + 1} down`}>
        Down
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={onRemove} aria-label={`Remove ${noun} ${index + 1}`}>
        Remove
      </Button>
    </div>
  )
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item))
}

export function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index)
}

export function splitList(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
