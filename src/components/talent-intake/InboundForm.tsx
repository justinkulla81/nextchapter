'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { submitInbound, type InboundFormState } from '@/app/in/actions'
import { INTAKE_CONSENT_SCOPES, INTAKE_CONSENT_SCOPE_LABELS } from '@/lib/recruiter/intake/constants'

const MAX_MB = 10

// The Inbound form: the résumé and one button. The name and email are read from the résumé; the two fields appear only
// when it has no email. Note, LinkedIn and what the firm may see sit under one optional line. The file is held in state
// and sent by hand, so an error never clears it.
export function InboundForm({
  firmSlug,
  recruiterSlug,
  notFit,
  firmName,
  who,
  accent,
  onAccent,
  paper,
  line,
  muted,
}: {
  firmSlug: string
  recruiterSlug: string | null
  notFit: boolean
  firmName: string
  who: string
  accent: string
  onAccent: string
  paper: string
  line: string
  muted: string
}) {
  const [state, setState] = useState<InboundFormState>(undefined)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    posthog.capture('talent_inbound_page_viewed', { firmSlug, recruiterSlug, notFit })
  }, [firmSlug, recruiterSlug, notFit])

  const choose = (f: File | null) => {
    setFileError(null)
    if (!f) return setFile(null)
    if (!/\.(pdf|docx)$/i.test(f.name)) return setFileError('Please choose a PDF or Word (.docx) file.')
    if (f.size > MAX_MB * 1024 * 1024) return setFileError(`That file is over ${MAX_MB} MB. Please choose a smaller one.`)
    setFile(f)
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) return setFileError('Choose your résumé first.')
    const fd = new FormData(e.currentTarget)
    fd.set('file', file)
    start(async () => setState(await submitInbound(undefined, fd)))
  }

  if (state?.sent) {
    return (
      <div role="status" className="space-y-2 border p-6" style={{ background: paper, borderColor: line }}>
        <p className="text-xl font-semibold">Thank you{state.firstName ? `, ${state.firstName}` : ''}.</p>
        <p style={{ color: muted }}>
          {notFit ? `${who} has your details.` : `${who} has your résumé.`} Check your email for your free NextChapter profile.
        </p>
      </div>
    )
  }

  const label = 'text-sm font-semibold'
  const input = 'mt-1 w-full border bg-white px-3 py-2 text-base font-normal'
  return (
    <form onSubmit={submit} className="space-y-5" style={pending ? { cursor: 'wait' } : undefined}>
      <input type="hidden" name="firmSlug" value={firmSlug} />
      {recruiterSlug && <input type="hidden" name="recruiterSlug" value={recruiterSlug} />}
      {notFit && <input type="hidden" name="nf" value="1" />}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div>
        <input
          ref={picker}
          id="file"
          type="file"
          accept=".pdf,.docx"
          className="peer sr-only"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
        <label
          htmlFor="file"
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0] ?? null) }}
          className="flex cursor-pointer flex-col items-start gap-2 border-2 border-dashed p-6 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
          style={{ background: paper, borderColor: dragging ? accent : line, outlineColor: accent }}
        >
          {file ? (
            <>
              <span className="text-lg font-semibold">{file.name}</span>
              <span className="text-sm" style={{ color: muted }}>Select to choose a different file.</span>
            </>
          ) : (
            <>
              <span className="text-lg font-semibold">Drop your résumé here</span>
              <span className="text-sm" style={{ color: muted }}>PDF or Word, up to {MAX_MB} MB. Or select to choose a file.</span>
            </>
          )}
        </label>
        {fileError && <p role="alert" className="mt-2 text-sm text-destructive">{fileError}</p>}
      </div>

      {state?.needsContact && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Full name<input name="fullName" autoComplete="name" required className={input} style={{ borderColor: line }} /></label>
          <label className={label}>Email<input name="email" type="email" autoComplete="email" required className={input} style={{ borderColor: line }} /></label>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold" style={{ color: muted }}>Add a note, LinkedIn or what {firmName} can see (optional)</summary>
        <div className="mt-4 space-y-4">
          <label className={`block ${label}`}>LinkedIn URL<input name="linkedinUrl" type="url" placeholder="https://www.linkedin.com/in/…" className={input} style={{ borderColor: line }} /></label>
          <label className={`block ${label}`}>Note<textarea name="note" rows={3} maxLength={1000} placeholder="What you're looking for next" className={input} style={{ borderColor: line }} /></label>
          <fieldset className="space-y-3 border p-4" style={{ borderColor: line }}>
            <legend className="px-1 font-semibold">Keep {firmName} posted on my progress?</legend>
            <p className="text-xs" style={{ color: muted }}>Pick what to share. You can change it or disconnect anytime.</p>
            {INTAKE_CONSENT_SCOPES.map((scope) => (
              <label key={scope} className="flex items-start gap-3">
                <input type="checkbox" name="consent" value={scope} className="mt-0.5 size-4" />
                <span>
                  <span className="font-medium">{INTAKE_CONSENT_SCOPE_LABELS[scope].label}</span>
                  <span className="block" style={{ color: muted }}>{INTAKE_CONSENT_SCOPE_LABELS[scope].detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </details>

      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center px-7 py-3.5 w-full text-sm font-semibold disabled:cursor-wait"
        style={{ background: accent, color: onAccent, cursor: pending ? 'wait' : 'pointer' }}
      >
        {pending ? 'Sending…' : notFit ? 'Send my résumé' : `Send my résumé to ${firmName}`}
      </button>
      <p className="text-xs" style={{ color: muted }}>
        Sending creates your free NextChapter profile. We only share what you choose with {firmName}. See our{' '}
        <a href="/privacy-policy" className="underline">privacy policy</a>.
      </p>
    </form>
  )
}
