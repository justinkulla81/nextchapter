'use client'

import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import type { VariantProps } from 'class-variance-authority'

interface SubmitButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  pendingLabel?: React.ReactNode
}

// Drop-in replacement for <Button type="submit"> inside a <form action={...}>
// — shows the busy cursor and disables itself while the action is pending,
// per design-principles.md. Must be a child of the <form>, not the component
// that renders the <form>, since useFormStatus only sees its parent form.
export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className={cn(className, pending && 'cursor-progress')}
      {...props}
    >
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  )
}
