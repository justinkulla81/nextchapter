'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import type { VariantProps } from 'class-variance-authority'

interface SubmitButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  pendingLabel?: React.ReactNode
  savedLabel?: React.ReactNode
}

// How long the gray "Saved" confirmation shows before the button reverts to
// its normal idle label — long enough to register as feedback, short enough
// not to look stuck.
const SAVED_DISPLAY_MS = 2000

// Drop-in replacement for <Button type="submit"> inside a <form action={...}>
// — shows the busy cursor and disables itself while the action is pending,
// per design-principles.md. Must be a child of the <form>, not the component
// that renders the <form>, since useFormStatus only sees its parent form.
//
// Every pending->idle transition is treated as a successful save and shown
// as a brief gray "Saved" state — this component only sees pending/not
// (useFormStatus has no result value), so it can't distinguish a real
// failure from success. Forms that surface their own error text below the
// button (the common pattern here) are unaffected either way; this is purely
// the button's own visual confirmation, applied uniformly sitewide.
export function SubmitButton({
  children,
  pendingLabel,
  savedLabel = 'Saved',
  className,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()
  const wasPending = useRef(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    const finished = wasPending.current && !pending
    wasPending.current = pending
    if (!finished) return
    setJustSaved(true)
    const timer = setTimeout(() => setJustSaved(false), SAVED_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [pending])

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        className,
        pending && 'cursor-progress',
        justSaved && 'border-transparent bg-muted text-muted-foreground hover:bg-muted'
      )}
      {...props}
    >
      {pending ? (pendingLabel ?? children) : justSaved ? savedLabel : children}
    </Button>
  )
}
