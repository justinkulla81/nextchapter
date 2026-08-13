'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function TagInput({
  name,
  defaultValue,
  placeholder,
  capitalizeFirstLetter,
  maxTags,
  inputType,
}: {
  name: string
  defaultValue: string[]
  placeholder?: string
  // On for proper-noun-like tags (e.g. industries) so "fintech" saves as
  // "Fintech" — off by default since not every use of this component is
  // capitalization-safe (e.g. free-text resume keywords).
  capitalizeFirstLetter?: boolean
  // Caps the list at N tags — once reached, the draft input hides instead
  // of silently accepting (and dropping) more. Undefined means unlimited,
  // the existing behavior every other caller of this component keeps.
  maxTags?: number
  // Passed through to the draft <Input> so e.g. an emails list gets the
  // browser's email keyboard/validation affordances. Defaults to the
  // Input component's own default (text).
  inputType?: string
}) {
  const [tags, setTags] = useState<string[]>(defaultValue)
  const [draft, setDraft] = useState('')
  const atLimit = maxTags !== undefined && tags.length >= maxTags

  function addTag() {
    if (atLimit) return
    let value = draft.trim()
    if (capitalizeFirstLetter && value) {
      value = value[0].toUpperCase() + value.slice(1)
    }
    if (value && !tags.includes(value)) {
      setTags((prev) => [...prev, value])
    }
    setDraft('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3" />
              </button>
              <input type="hidden" name={name} value={tag} />
            </span>
          ))}
        </div>
      )}
      {atLimit ? (
        <p className="text-xs text-muted-foreground">Limit of {maxTags} reached — remove one to add another.</p>
      ) : (
        <Input
          type={inputType}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={placeholder ?? 'Type and press Enter'}
        />
      )}
    </div>
  )
}
