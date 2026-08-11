'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// The candidate's own Dossier print/download has no known recipient at
// generation time (unlike a recruiter's authenticated view of a candidate,
// which has real Recruiter.fullName/firmName). Rather than fabricate one or
// omit the line outright, let the candidate optionally address the copy
// they're about to hand someone — session-only, never persisted, and the
// printed line only appears once a name is actually entered.
export function PreparedForField() {
  const [name, setName] = useState('')
  const [firm, setFirm] = useState('')
  const trimmedName = name.trim()
  const trimmedFirm = firm.trim()

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="preparedForName" className="text-xs text-muted-foreground">
            Who is this for? (optional — appears on the printed document)
          </Label>
          <Input
            id="preparedForName"
            placeholder="Recipient name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-48"
          />
        </div>
        <Input
          aria-label="Firm (optional)"
          placeholder="Firm (optional)"
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          className="h-8 w-48"
        />
      </div>
      {trimmedName && (
        <p className="hidden text-sm text-muted-foreground print:block">
          Prepared for {trimmedName}
          {trimmedFirm ? `, ${trimmedFirm}` : ''}
        </p>
      )}
    </div>
  )
}
