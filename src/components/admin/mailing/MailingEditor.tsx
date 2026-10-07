'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The email body editor: a plain box that looks like writing an email, with
 * four buttons — Bold, Underline, Bullets, Link — and merge tags. Pasted
 * text arrives as plain text so Word or web formatting never rides along;
 * the server strips anything beyond these formats anyway.
 */
export function MailingEditor({
  initialHtml,
  onChange,
  disabled,
}: {
  initialHtml: string
  onChange: (html: string) => void
  disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [linking, setLinking] = useState<{ range: Range } | null>(null)
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml
    // Only on mount: the editor owns its content after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = () => ref.current && onChange(ref.current.innerHTML)

  const exec = (command: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, value)
    emit()
  }

  const startLink = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !ref.current?.contains(sel.anchorNode)) {
      ref.current?.focus()
      return
    }
    setLinking({ range: sel.getRangeAt(0).cloneRange() })
    setUrl('')
  }

  const applyLink = () => {
    if (!linking) return
    let href = url.trim()
    if (!href) return setLinking(null)
    if (!/^(https?:|mailto:|\{\{)/i.test(href)) href = href.includes('@') && !href.includes('/') ? `mailto:${href}` : `https://${href}`
    const sel = window.getSelection()
    ref.current?.focus()
    sel?.removeAllRanges()
    sel?.addRange(linking.range)
    if (linking.range.collapsed) {
      document.execCommand('insertHTML', false, `<a href="${href.replace(/"/g, '&quot;')}">${href.replace(/</g, '&lt;')}</a>`)
    } else {
      document.execCommand('createLink', false, href)
    }
    setLinking(null)
    emit()
  }

  const button = 'rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand'

  return (
    <div className="rounded-lg border border-input">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5" role="toolbar" aria-label="Formatting">
        <button type="button" className={`${button} font-bold`} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} aria-label="Bold" disabled={disabled}>B</button>
        <button type="button" className={`${button} underline`} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} aria-label="Underline" disabled={disabled}>U</button>
        <button type="button" className={button} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')} aria-label="Bulleted list" disabled={disabled}>• Bullets</button>
        <button type="button" className={button} onMouseDown={(e) => e.preventDefault()} onClick={startLink} aria-label="Add link" disabled={disabled}>Link</button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <span className="text-xs text-muted-foreground">Insert:</span>
        <button type="button" className={button} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertText', '{{firstName}}')} disabled={disabled}>First name</button>
        <button type="button" className={button} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertText', '{{orgName}}')} disabled={disabled}>Organization</button>
      </div>
      {linking && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
          <label htmlFor="mailing-link-url" className="text-xs font-medium">Link to</label>
          <input
            id="mailing-link-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } if (e.key === 'Escape') setLinking(null) }}
            placeholder="https://…" className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 text-xs"
          />
          <button type="button" onClick={applyLink} className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white">Add link</button>
          <button type="button" onClick={() => setLinking(null)} className="rounded-md border border-border px-2.5 py-1 text-xs">Cancel</button>
        </div>
      )}
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="Message"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          e.preventDefault()
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
          emit()
        }}
        className="min-h-64 px-3 py-2 text-[15px] leading-relaxed outline-none [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3"
      />
    </div>
  )
}
