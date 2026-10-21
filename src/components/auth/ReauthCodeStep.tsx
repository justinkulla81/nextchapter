'use client'

import { useState } from 'react'

/**
 * The "confirm it's you" step inside an irreversible-action form (CASA 2.4.1).
 * Shown when the server answered with a challenge: it emailed a code. The
 * member types it and presses the form's own submit button again; "Send a
 * new code" resubmits with reauthResend=1. The typed code stays put if it is
 * wrong, so it can be fixed rather than retyped.
 */
export function ReauthCodeStep({ sentTo, error, pending }: { sentTo: string; error?: string; pending: boolean }) {
  const [code, setCode] = useState('')
  return (
    <div className="space-y-2 rounded-md bg-muted/60 p-3">
      <p className="text-sm text-ink">
        To make sure it’s you, we emailed a code to <strong>{sentTo}</strong>. Enter it here, then press the button below again.
      </p>
      <label htmlFor="reauth-code" className="block text-sm font-medium text-ink">
        Code from the email
      </label>
      <input
        id="reauth-code"
        name="reauthCode"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,12}"
        maxLength={12}
        required
        className="block h-10 w-40 rounded-md border border-border bg-white px-3 text-base tracking-widest text-ink"
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        name="reauthResend"
        value="1"
        formNoValidate
        disabled={pending}
        className="text-sm font-medium text-brand underline underline-offset-4 disabled:cursor-wait disabled:opacity-70"
      >
        Send a new code
      </button>
    </div>
  )
}
