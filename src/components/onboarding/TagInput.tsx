'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function TagInput({
  name,
  defaultValue,
  placeholder,
}: {
  name: string
  defaultValue: string[]
  placeholder?: string
}) {
  const [tags, setTags] = useState<string[]>(defaultValue)
  const [draft, setDraft] = useState('')

  function addTag() {
    const value = draft.trim()
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
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={placeholder ?? 'Type and press Enter'}
      />
    </div>
  )
}
