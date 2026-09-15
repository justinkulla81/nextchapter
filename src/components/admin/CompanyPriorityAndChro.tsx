'use client'

import { useState } from 'react'
import {
  setCompanyPriority,
  updateCompanyChroContact,
} from '@/app/support/admin/(portal)/crm/warn/actions'

export function CompanyPriorityAndChro({
  companyId,
  priority,
  chroName,
  chroEmail,
  chroLinkedinUrl,
}: {
  companyId: string
  priority: 'P0' | 'P1' | 'P2' | null
  chroName: string | null
  chroEmail: string | null
  chroLinkedinUrl: string | null
}) {
  const [tier, setTier] = useState(priority)
  const [pending, setPending] = useState(false)
  const [editingChro, setEditingChro] = useState(false)
  const hasChro = Boolean(chroName || chroEmail || chroLinkedinUrl)

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
      <select
        aria-label="Priority"
        disabled={pending}
        value={tier ?? ''}
        onChange={async (e) => {
          const next = (e.target.value || null) as 'P0' | 'P1' | 'P2' | null
          setPending(true)
          setTier(next)
          await setCompanyPriority(companyId, next)
          setPending(false)
        }}
        className={`h-6 rounded border border-input bg-transparent px-1 text-xs ${pending ? 'cursor-progress opacity-60' : ''} ${tier === 'P0' ? 'text-destructive' : tier === 'P1' ? 'text-orange' : 'text-muted-foreground'}`}
      >
        <option value="">No priority</option>
        <option value="P0">P0 — Immediate</option>
        <option value="P1">P1 — High</option>
        <option value="P2">P2 — Important, not urgent</option>
      </select>

      {!editingChro && (
        <button type="button" onClick={() => setEditingChro(true)} className="text-muted-foreground hover:underline">
          {hasChro ? `CHRO: ${chroName ?? chroEmail ?? 'contact on file'}` : '+ CHRO contact'}
        </button>
      )}

      {editingChro && (
        <form
          action={async (fd) => {
            fd.set('companyId', companyId)
            await updateCompanyChroContact(fd)
            setEditingChro(false)
          }}
          className="flex flex-wrap items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <input name="chroName" defaultValue={chroName ?? ''} placeholder="CHRO name" className="h-6 w-28 rounded border border-input bg-transparent px-1 text-xs" />
          <input name="chroEmail" type="email" defaultValue={chroEmail ?? ''} placeholder="Email" className="h-6 w-36 rounded border border-input bg-transparent px-1 text-xs" />
          <input name="chroLinkedinUrl" type="url" defaultValue={chroLinkedinUrl ?? ''} placeholder="LinkedIn URL" className="h-6 w-36 rounded border border-input bg-transparent px-1 text-xs" />
          <button type="submit" className="rounded border border-border px-1.5 py-0.5 hover:bg-muted">Save</button>
          <button type="button" onClick={() => setEditingChro(false)} className="text-muted-foreground hover:underline">Cancel</button>
        </form>
      )}
    </span>
  )
}
