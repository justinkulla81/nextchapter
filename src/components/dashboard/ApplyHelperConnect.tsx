'use client'

import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { getConnectCode } from '@/app/dashboard/apply-helper/actions'

export function ApplyHelperConnect({ sample = false }: { sample?: boolean }) {
  const [code, setCode] = useState<string | null>(sample ? 'nca1.sample-code-shown-here' : null)
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const btn = 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted'

  return (
    <div className="space-y-2">
      {code ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-full truncate rounded-lg bg-muted px-3 py-2 text-sm">{code}</code>
          <button
            type="button"
            className={btn}
            onClick={async () => {
              await navigator.clipboard.writeText(code)
              setNote('Copied. Paste it into the helper.')
              posthog.capture('apply_helper_code_copied')
            }}
          >
            Copy code
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (sample) return
              const r = await getConnectCode()
              if (r.ok) { setCode(r.code); setNote(`Works until ${r.expires}. Keep it private: anyone with it can read your contact details and résumé.`) }
              else setNote(r.error)
            })
          }
        >
          {pending ? 'Making your code…' : 'Get my connect code'}
        </button>
      )}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  )
}
