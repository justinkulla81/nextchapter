'use client'

import { useState } from 'react'
import {
  toggleCompanyPriority,
  updateCompanyChroContact,
} from '@/app/support/admin/(portal)/crm/warn/actions'

export function CompanyPriorityAndChro({
  companyId,
  isPriority,
  chroName,
  chroEmail,
  chroLinkedinUrl,
}: {
  companyId: string
  isPriority: boolean
  chroName: string | null
  chroEmail: string | null
  chroLinkedinUrl: string | null
}) {
  const [priority, setPriority] = useState(isPriority)
  const [pending, setPending] = useState(false)
  const [editingChro, setEditingChro] = useState(false)
  const hasChro = Boolean(chroName || chroEmail || chroLinkedinUrl)

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
      <button
        type="button"
        disabled={pending}
        title={priority ? 'Priority company — click to unflag' : 'Flag as a priority company'}
        onClick={async () => {
          setPending(true)
          const next = !priority
          setPriority(next)
          await toggleCompanyPriority(companyId, next)
          setPending(false)
        }}
        className={priority ? 'text-warning' : 'text-muted-foreground/40 hover:text-muted-foreground'}
        aria-pressed={priority}
        aria-label="Toggle priority"
      >
        {priority ? '★ Priority' : '☆'}
      </button>

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
