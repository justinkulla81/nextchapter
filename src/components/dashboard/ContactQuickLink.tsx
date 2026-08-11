'use client'

import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { cn } from '@/lib/utils'

// A contact's name, made actionable when we have a way to reach them:
// opens Gmail compose if they have an email on file, falls back to their
// LinkedIn profile, or just renders as plain text if we have neither.
export function ContactQuickLink({
  name,
  email,
  linkedinUrl,
  className,
}: {
  name: string
  email?: string | null
  linkedinUrl?: string | null
  className?: string
}) {
  const href = email ? gmailComposeHref(email, '') : (linkedinUrl ?? null)
  if (!href) {
    return <span className={cn('font-medium text-foreground', className)}>{name}</span>
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('font-medium text-brand hover:underline', className)}
    >
      {name}
    </a>
  )
}
