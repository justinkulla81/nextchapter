'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

// A single page-level "Save" that submits every per-card form inside the
// page's card container at once — each card keeps its own working Confirm
// action/validation; this just triggers all of them together as a
// convenience, rather than merging four independent server actions into one.
export function ProfileSaveAllButton({ containerId }: { containerId: string }) {
  const [saved, setSaved] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSave() {
    const container = document.getElementById(containerId)
    const forms = container?.querySelectorAll('form') ?? []
    forms.forEach((form) => form.requestSubmit())
    setSaved(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Button type="button" onClick={handleSave} className="cursor-pointer">
      {saved ? 'Saved ✓' : 'Save profile'}
    </Button>
  )
}
